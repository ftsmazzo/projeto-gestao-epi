import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DistributorInboundStatus,
  DistributorMovementDirection,
  DistributorMovementSource,
  OrganizationKind,
  Prisma,
} from '@prisma/client';
import { validateCnpj } from '../common/cnpj';
import { PrismaService } from '../prisma/prisma.service';
import { extractInvoiceFromFile } from '../portal/invoice-extract';
import { saveDistributorInboundFile } from './distributor-document.storage';
import type {
  AddDistributorVariantDto,
  CreateDistributorProductDto,
  CreateOutboundFromQuoteDto,
  CreatePurchaseOrderDto,
  CreateQuoteDto,
  ManualDistributorMovementDto,
  SetSellerCeilingDto,
  UpdateDistributorProductDto,
} from './dto/distributor.dto';
import {
  CatalogRuleError,
  measureCubage,
  normalizeCatalog,
  normalizeCatalogPatch,
  type CatalogInput,
} from './catalog.rules';
import { FiscalCertificateError, sealCertificate } from './fiscal-certificate';
import {
  NfeOutboundError,
  OUTBOUND_EMISSION_ENABLED,
  assertOutboundAuthorize,
  buildOutboundLines,
  outboundBlockers,
} from './nfe-outbound.rules';
import { NfeXmlError, parseNfeXml } from './nfe-xml.rules';
import {
  PurchaseOrderRuleError,
  receivePurchaseOrder,
  rejectPurchaseOrder,
  releasePurchaseOrder,
} from './purchase-order.rules';
import {
  LotRuleError,
  allocateFefo,
  formatExpiryDay,
  normalizeLotCode,
  parseExpiryDay,
} from './lot.rules';
import {
  QuoteRuleError,
  decideQuote,
  percentToBps,
  sumGrantedCents,
} from './quote.rules';

const productInclude = {
  variants: {
    orderBy: { label: 'asc' as const },
    include: {
      balance: true,
      lots: {
        orderBy: [{ expiresOn: 'asc' as const }, { createdAt: 'asc' as const }],
      },
    },
  },
};

@Injectable()
export class DistributorService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(organizationId: string, role: string) {
    await this.requireDistributor(organizationId, role);
    const products = await this.prisma.distributorProduct.findMany({
      where: { organizationId },
      include: productInclude,
      orderBy: { name: 'asc' },
    });
    return products.map(toProductView);
  }

  async createProduct(
    organizationId: string,
    role: string,
    dto: CreateDistributorProductDto,
  ) {
    await this.requireDistributor(organizationId, role, { manager: true });
    const internalSku = dto.internalSku.trim();
    const labels = uniqueLabels(dto.variants);
    if (!internalSku || labels.length === 0) {
      throw new BadRequestException('Informe o codigo interno e ao menos uma variante.');
    }
    let catalog;
    try {
      catalog = normalizeCatalog(catalogInput(dto));
    } catch (error) {
      throw this.asCatalogError(error);
    }
    try {
      const created = await this.prisma.distributorProduct.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          internalSku,
          supplierSku: emptyToNull(dto.supplierSku),
          caNumber: normalizeCa(dto.caNumber),
          minQuantity: dto.minQuantity ?? null,
          tracksLot: dto.tracksLot === true,
          ...catalog,
          variants: {
            create: labels.map((label) => ({
              label,
              balance: { create: { quantity: 0 } },
            })),
          },
        },
        include: productInclude,
      });
      return toProductView(created);
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException(
          'Ja existe um produto com este codigo interno, ou a variante se repete.',
        );
      }
      throw error;
    }
  }

  async updateProduct(
    organizationId: string,
    role: string,
    productId: string,
    dto: UpdateDistributorProductDto,
  ) {
    await this.requireDistributor(organizationId, role, { manager: true });
    await this.requireProduct(organizationId, productId);
    const data: Prisma.DistributorProductUpdateInput = {};
    if (dto.name != null) data.name = dto.name.trim();
    if (dto.minQuantity !== undefined) data.minQuantity = dto.minQuantity;
    if (dto.caNumber !== undefined) data.caNumber = normalizeCa(dto.caNumber);
    if (dto.tracksLot !== undefined) {
      const current = await this.prisma.distributorProduct.findFirst({
        where: { id: productId, organizationId },
        include: { variants: { include: { balance: true, lots: true } } },
      });
      if (dto.tracksLot && current && !current.tracksLot) {
        const stocked = current.variants.some(
          (variant) => (variant.balance?.quantity ?? 0) > 0,
        );
        if (stocked) {
          throw new ConflictException(
            'Zere o saldo antes de ligar o controle de lote.',
          );
        }
      }
      if (!dto.tracksLot && current?.tracksLot) {
        const stocked = current.variants.some((variant) =>
          variant.lots.some((lot) => lot.quantity > 0),
        );
        if (stocked) {
          throw new ConflictException('Ainda ha saldo em lote.');
        }
      }
      data.tracksLot = dto.tracksLot;
    }
    try {
      Object.assign(data, normalizeCatalogPatch(catalogInput(dto)));
    } catch (error) {
      throw this.asCatalogError(error);
    }
    const updated = await this.prisma.distributorProduct.update({
      where: { id: productId },
      data,
      include: productInclude,
    });
    return toProductView(updated);
  }

  async addVariant(
    organizationId: string,
    role: string,
    productId: string,
    dto: AddDistributorVariantDto,
  ) {
    await this.requireDistributor(organizationId, role, { manager: true });
    await this.requireProduct(organizationId, productId);
    const label = dto.label.trim();
    if (!label) {
      throw new BadRequestException('Informe o tamanho ou numero.');
    }
    try {
      await this.prisma.distributorVariant.create({
        data: {
          productId,
          label,
          balance: { create: { quantity: 0 } },
        },
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException('Esta variante ja existe neste produto.');
      }
      throw error;
    }
    const product = await this.prisma.distributorProduct.findUniqueOrThrow({
      where: { id: productId },
      include: productInclude,
    });
    return toProductView(product);
  }

  async listBalances(organizationId: string, role: string) {
    await this.requireDistributor(organizationId, role);
    const products = await this.prisma.distributorProduct.findMany({
      where: { organizationId },
      include: productInclude,
      orderBy: { name: 'asc' },
    });
    return products.flatMap((product) =>
      product.variants.map((variant) => toBalanceRow(product, variant)),
    );
  }

  async listLowStock(organizationId: string, role: string) {
    const rows = await this.listBalances(organizationId, role);
    return rows.filter(
      (row) => row.minQuantity != null && row.quantity <= row.minQuantity,
    );
  }

  async lookupCa(organizationId: string, role: string, caNumber: string) {
    await this.requireDistributor(organizationId, role);
    const normalized = normalizeCa(caNumber);
    if (!normalized) {
      throw new BadRequestException('Informe o numero do CA.');
    }
    const certificate = await this.prisma.caCertificate.findUnique({
      where: { caNumber: normalized },
      select: {
        caNumber: true,
        equipmentName: true,
        equipmentDescription: true,
        manufacturerName: true,
        status: true,
      },
    });
    if (!certificate) {
      return { found: false as const, caNumber: normalized };
    }
    return { found: true as const, ...certificate };
  }

  async move(
    organizationId: string,
    role: string,
    userId: string,
    dto: ManualDistributorMovementDto,
  ) {
    await this.requireDistributor(organizationId, role);
    return this.applyMovement({
      organizationId,
      userId,
      variantId: dto.variantId,
      direction: dto.direction,
      quantity: dto.quantity,
      source: DistributorMovementSource.MANUAL,
      documentId: null,
      purchaseOrderId: null,
      lotCode: dto.lotCode,
      expiresOn: dto.expiresOn,
    });
  }

  async extractInbound(
    organizationId: string,
    role: string,
    userId: string,
    file: Express.Multer.File | undefined,
  ) {
    await this.requireDistributor(organizationId, role);
    if (!file?.buffer?.byteLength) {
      throw new BadRequestException('Envie o arquivo da nota de compra.');
    }
    if (file.buffer.toString('utf8').includes('<infNFe')) {
      return this.importNfeXml(organizationId, userId, file);
    }
    const saved = await saveDistributorInboundFile({
      organizationId,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
    });
    const extraction = await extractInvoiceFromFile({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
    });
    const document = await this.prisma.distributorInboundDocument.create({
      data: {
        organizationId,
        status: DistributorInboundStatus.DRAFT,
        supplierName: extraction.supplierName,
        invoiceNumber: extraction.invoiceNumber,
        filePath: saved.relativePath,
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        extraction: extraction as unknown as Prisma.InputJsonValue,
        createdByUserId: userId,
        lines: {
          create: extraction.lines.map((line) => ({
            description: line.description.slice(0, 500),
            quantity: positiveInt(line.quantity),
            unitCostCents: line.unitCostCents,
            caNumber: normalizeCa(line.caNumber),
          })),
        },
      },
      include: documentInclude,
    });
    return toDocumentView(document);
  }

  private async importNfeXml(
    organizationId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    let parsed;
    try {
      parsed = parseNfeXml(file.buffer.toString('utf8'));
    } catch (error) {
      throw this.asNfeError(error);
    }
    const profile = await this.prisma.distributorFiscalProfile.findUnique({
      where: { organizationId },
    });
    if (profile && profile.cnpj !== parsed.recipientCnpj) {
      throw new BadRequestException(
        'Esta nota nao foi emitida para o CNPJ cadastrado da distribuidora.',
      );
    }
    const saved = await saveDistributorInboundFile({
      organizationId,
      buffer: file.buffer,
      mimeType: 'application/xml',
      originalName: file.originalname,
    });
    try {
      const document = await this.prisma.distributorInboundDocument.create({
        data: {
          organizationId,
          status: DistributorInboundStatus.DRAFT,
          supplierName: parsed.supplierName,
          supplierCnpj: parsed.supplierCnpj,
          invoiceNumber: parsed.invoiceNumber,
          accessKey: parsed.accessKey,
          filePath: saved.relativePath,
          fileName: saved.fileName,
          mimeType: 'application/xml',
          extraction: {
            method: 'NFE_XML',
            message: profile
              ? 'XML lido. O estoque ainda nao mudou.'
              : 'XML lido. Cadastre o CNPJ fiscal para conferir o destinatario. O estoque ainda nao mudou.',
          },
          createdByUserId: userId,
          lines: {
            create: parsed.lines.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              unitCostCents: line.unitCostCents,
              ncm: line.ncm,
              cfop: line.cfop,
            })),
          },
        },
        include: documentInclude,
      });
      return toDocumentView(document);
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException('Esta chave de acesso ja foi importada.');
      }
      throw error;
    }
  }

  async getFiscalProfile(organizationId: string, role: string) {
    await this.requireDistributor(organizationId, role);
    return this.fiscalView(organizationId);
  }

  async saveFiscalProfile(
    organizationId: string,
    role: string,
    dto: { cnpj: string; uf: string; stateRegistration?: string | null; regime?: 'PRESUMIDO' | 'SIMPLES' | 'REAL' },
  ) {
    await this.requireDistributor(organizationId, role, { manager: true });
    const cnpj = validateCnpj(dto.cnpj);
    if (!cnpj.ok) throw new BadRequestException(cnpj.message);
    const uf = dto.uf.trim().toUpperCase();
    if (!BRAZIL_UFS.has(uf)) {
      throw new BadRequestException('Informe a UF da distribuidora.');
    }
    const regime = dto.regime ?? 'PRESUMIDO';
    await this.prisma.distributorFiscalProfile.upsert({
      where: { organizationId },
      create: {
        organizationId,
        cnpj: cnpj.normalized,
        uf,
        stateRegistration: emptyToNull(dto.stateRegistration),
        regime,
      },
      update: {
        cnpj: cnpj.normalized,
        uf,
        stateRegistration: emptyToNull(dto.stateRegistration),
        regime,
      },
    });
    await this.prisma.distributorDfeCursor.upsert({
      where: { organizationId },
      create: { organizationId, lastNsu: '0' },
      update: {},
    });
    return this.fiscalView(organizationId);
  }

  async storeFiscalCertificate(
    organizationId: string,
    role: string,
    file: Express.Multer.File | undefined,
    password: string | undefined,
  ) {
    await this.requireDistributor(organizationId, role, { manager: true });
    const profile = await this.prisma.distributorFiscalProfile.findUnique({
      where: { organizationId },
    });
    if (!profile) {
      throw new BadRequestException('Cadastre o CNPJ e a UF antes do certificado.');
    }
    if (!file?.buffer?.byteLength || file.buffer.byteLength > 1_000_000) {
      throw new BadRequestException('Envie o arquivo A1 (.pfx) do certificado.');
    }
    if (!password?.trim()) {
      throw new BadRequestException('Informe a senha do certificado.');
    }
    let sealed;
    try {
      sealed = sealCertificate(file.buffer, password.trim());
    } catch (error) {
      if (error instanceof FiscalCertificateError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    await this.prisma.distributorFiscalProfile.update({
      where: { organizationId },
      data: {
        certificateCipher: new Uint8Array(sealed.cipher),
        certificateIv: new Uint8Array(sealed.iv),
        certificateTag: new Uint8Array(sealed.tag),
        certificateUpdatedAt: new Date(),
      },
    });
    return this.fiscalView(organizationId);
  }

  async getInbound(organizationId: string, role: string, documentId: string) {
    await this.requireDistributor(organizationId, role);
    const document = await this.requireDocument(organizationId, documentId);
    return toDocumentView(document);
  }

  async linkLine(
    organizationId: string,
    role: string,
    documentId: string,
    lineId: string,
    variantId: string | null | undefined,
    lot?: { lotCode?: string | null; expiresOn?: string | null },
  ) {
    await this.requireDistributor(organizationId, role);
    const document = await this.requireDocument(organizationId, documentId);
    if (document.status !== DistributorInboundStatus.DRAFT) {
      throw new ConflictException('Este rascunho ja foi encerrado.');
    }
    const line = document.lines.find((item) => item.id === lineId);
    if (!line) {
      throw new NotFoundException('Linha nao encontrada neste rascunho.');
    }
    if (variantId) {
      await this.requireVariant(organizationId, variantId);
    }
    let lotCode: string | null | undefined;
    let expiresOn: Date | null | undefined;
    if (lot && ('lotCode' in lot || 'expiresOn' in lot)) {
      try {
        lotCode = normalizeLotCode(lot.lotCode);
        expiresOn = parseExpiryDay(lot.expiresOn);
      } catch (error) {
        throw this.asLotError(error);
      }
    }
    await this.prisma.distributorInboundLine.update({
      where: { id: lineId },
      data: {
        variantId: variantId || null,
        ...(lotCode !== undefined ? { lotCode } : {}),
        ...(expiresOn !== undefined ? { expiresOn } : {}),
      },
    });
    return this.getInbound(organizationId, role, documentId);
  }

  async confirmInbound(
    organizationId: string,
    role: string,
    userId: string,
    documentId: string,
  ) {
    await this.requireDistributor(organizationId, role);
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.distributorInboundDocument.findFirst({
        where: { id: documentId, organizationId },
        include: { lines: true },
      });
      if (!document) {
        throw new NotFoundException('Rascunho nao encontrado.');
      }
      if (document.status === DistributorInboundStatus.CONFIRMED) {
        throw new ConflictException('Esta nota ja entrou no estoque.');
      }
      if (document.status !== DistributorInboundStatus.DRAFT) {
        throw new ConflictException('Este rascunho foi descartado.');
      }
      const ready = document.lines.filter(
        (line) => line.variantId && line.quantity > 0,
      );
      if (ready.length === 0) {
        throw new BadRequestException(
          'Vincule ao menos uma linha com quantidade a uma variante.',
        );
      }
      const claimed = await tx.distributorInboundDocument.updateMany({
        where: {
          id: document.id,
          organizationId,
          status: DistributorInboundStatus.DRAFT,
        },
        data: { status: DistributorInboundStatus.CONFIRMED },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Esta nota ja entrou no estoque.');
      }
      for (const line of ready) {
        await this.applyMovement(
          {
            organizationId,
            userId,
            variantId: line.variantId as string,
            direction: 'IN',
            quantity: line.quantity,
            source: DistributorMovementSource.INVOICE,
            documentId: document.id,
            purchaseOrderId: null,
            lotCode: line.lotCode,
            expiresOn: formatExpiryDay(line.expiresOn),
          },
          tx,
        );
      }
      const updated = await tx.distributorInboundDocument.findFirstOrThrow({
        where: { id: document.id },
        include: documentInclude,
      });
      return toDocumentView(updated);
    });
  }

  async discardInbound(
    organizationId: string,
    role: string,
    documentId: string,
  ) {
    await this.requireDistributor(organizationId, role);
    const document = await this.requireDocument(organizationId, documentId);
    if (document.status === DistributorInboundStatus.CONFIRMED) {
      throw new ConflictException('Nota ja confirmada nao pode ser descartada.');
    }
    if (document.status === DistributorInboundStatus.DISCARDED) {
      return toDocumentView(document);
    }
    const updated = await this.prisma.distributorInboundDocument.update({
      where: { id: document.id },
      data: { status: DistributorInboundStatus.DISCARDED },
      include: documentInclude,
    });
    return toDocumentView(updated);
  }

  async listPurchaseOrders(organizationId: string, role: string) {
    await this.requireDistributor(organizationId, role);
    const orders = await this.prisma.distributorPurchaseOrder.findMany({
      where: { organizationId },
      include: purchaseOrderInclude,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(toPurchaseOrderView);
  }

  async createPurchaseOrder(
    organizationId: string,
    role: string,
    userId: string,
    dto: CreatePurchaseOrderDto,
  ) {
    await this.requireDistributor(organizationId, role);
    const supplierName = dto.supplierName.trim();
    const lines = mergePurchaseLines(dto.lines);
    if (!supplierName || lines.length === 0) {
      throw new BadRequestException(
        'Informe o fornecedor e ao menos um item com quantidade.',
      );
    }
    for (const line of lines) {
      await this.requireVariant(organizationId, line.variantId);
    }
    const created = await this.prisma.distributorPurchaseOrder.create({
      data: {
        organizationId,
        supplierName,
        createdByUserId: userId,
        lines: { create: lines },
      },
      include: purchaseOrderInclude,
    });
    return toPurchaseOrderView(created);
  }

  async releasePurchaseOrder(
    organizationId: string,
    role: string,
    userId: string,
    orderId: string,
    step: 1 | 2,
  ) {
    await this.requireDistributor(organizationId, role);
    const current = await this.requirePurchaseOrder(organizationId, orderId);
    let next: 'AWAITING_SECOND' | 'APPROVED';
    try {
      next = releasePurchaseOrder({
        status: current.status,
        step,
        actorUserId: userId,
        firstApproverUserId: current.firstApprovedByUserId,
      });
    } catch (error) {
      throw this.asPurchaseConflict(error);
    }
    const now = new Date();
    const claimed = await this.prisma.distributorPurchaseOrder.updateMany({
      where: { id: current.id, organizationId, status: current.status },
      data:
        step === 1
          ? {
              status: next,
              firstApprovedByUserId: userId,
              firstApprovedAt: now,
            }
          : {
              status: next,
              secondApprovedByUserId: userId,
              secondApprovedAt: now,
            },
    });
    if (claimed.count !== 1) {
      throw new ConflictException('Este pedido ja mudou de etapa.');
    }
    return this.getPurchaseOrder(organizationId, role, orderId);
  }

  async rejectPurchaseOrder(
    organizationId: string,
    role: string,
    userId: string,
    orderId: string,
    note?: string,
  ) {
    await this.requireDistributor(organizationId, role);
    const current = await this.requirePurchaseOrder(organizationId, orderId);
    try {
      rejectPurchaseOrder(current.status);
    } catch (error) {
      throw this.asPurchaseConflict(error);
    }
    const claimed = await this.prisma.distributorPurchaseOrder.updateMany({
      where: {
        id: current.id,
        organizationId,
        status: current.status,
      },
      data: {
        status: 'REJECTED',
        rejectedByUserId: userId,
        rejectedAt: new Date(),
        rejectionNote: emptyToNull(note),
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException('Este pedido ja mudou de etapa.');
    }
    return this.getPurchaseOrder(organizationId, role, orderId);
  }

  async receivePurchaseOrder(
    organizationId: string,
    role: string,
    userId: string,
    orderId: string,
  ) {
    await this.requireDistributor(organizationId, role);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.distributorPurchaseOrder.findFirst({
        where: { id: orderId, organizationId },
        include: { lines: true },
      });
      if (!current) {
        throw new NotFoundException('Pedido nao encontrado.');
      }
      try {
        receivePurchaseOrder(current.status);
      } catch (error) {
        throw this.asPurchaseConflict(error);
      }
      const claimed = await tx.distributorPurchaseOrder.updateMany({
        where: { id: current.id, organizationId, status: 'APPROVED' },
        data: {
          status: 'RECEIVED',
          receivedByUserId: userId,
          receivedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Este pedido ja entrou no estoque.');
      }
      for (const line of current.lines) {
        await this.applyMovement(
          {
            organizationId,
            userId,
            variantId: line.variantId,
            direction: 'IN',
            quantity: line.quantity,
            source: DistributorMovementSource.PURCHASE_ORDER,
            documentId: null,
            purchaseOrderId: current.id,
            lotCode: line.lotCode,
            expiresOn: formatExpiryDay(line.expiresOn),
          },
          tx,
        );
      }
      const updated = await tx.distributorPurchaseOrder.findFirstOrThrow({
        where: { id: current.id },
        include: purchaseOrderInclude,
      });
      return toPurchaseOrderView(updated);
    });
  }

  private async getPurchaseOrder(
    organizationId: string,
    role: string,
    orderId: string,
  ) {
    await this.requireDistributor(organizationId, role);
    const order = await this.requirePurchaseOrder(organizationId, orderId);
    return toPurchaseOrderView(order);
  }

  private async applyMovement(
    input: {
      organizationId: string;
      userId: string;
      variantId: string;
      direction: 'IN' | 'OUT';
      quantity: number;
      source: DistributorMovementSource;
      documentId: string | null;
      purchaseOrderId: string | null;
      lotCode?: string | null;
      expiresOn?: string | null;
    },
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new BadRequestException('A quantidade precisa ser um inteiro maior que zero.');
    }
    const variant = await tx.distributorVariant.findFirst({
      where: {
        id: input.variantId,
        product: { organizationId: input.organizationId },
      },
      include: { balance: true, product: true, lots: true },
    });
    if (!variant?.balance) {
      throw new NotFoundException('Variante nao encontrada nesta distribuidora.');
    }
    const next =
      input.direction === 'OUT'
        ? variant.balance.quantity - input.quantity
        : variant.balance.quantity + input.quantity;
    if (next < 0) {
      throw new ConflictException(
        `Saida maior que o saldo de ${variant.product.name} (${variant.label}).`,
      );
    }
    let lotCode: string | null = null;
    let expiresOn: Date | null = null;
    try {
      lotCode = normalizeLotCode(input.lotCode);
      expiresOn = parseExpiryDay(input.expiresOn);
    } catch (error) {
      throw this.asLotError(error);
    }
    const direction =
      input.direction === 'OUT'
        ? DistributorMovementDirection.OUT
        : DistributorMovementDirection.IN;
    let lotSummary: string | null = null;
    if (!variant.product.tracksLot) {
      await tx.distributorMovement.create({
        data: {
          variantId: variant.id,
          direction,
          quantity: input.quantity,
          source: input.source,
          createdByUserId: input.userId,
          documentId: input.documentId,
          purchaseOrderId: input.purchaseOrderId,
        },
      });
    } else if (input.direction === 'IN') {
      if (!lotCode) {
        throw new BadRequestException('Informe o lote desta entrada.');
      }
      const existing = variant.lots.find((lot) => lot.code === lotCode);
      const lot = existing
        ? await tx.distributorLot.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + input.quantity,
              ...(expiresOn ? { expiresOn } : {}),
            },
          })
        : await tx.distributorLot.create({
            data: {
              variantId: variant.id,
              code: lotCode,
              expiresOn,
              quantity: input.quantity,
            },
          });
      lotSummary = lot.code;
      await tx.distributorMovement.create({
        data: {
          variantId: variant.id,
          direction,
          quantity: input.quantity,
          source: input.source,
          createdByUserId: input.userId,
          documentId: input.documentId,
          purchaseOrderId: input.purchaseOrderId,
          lotId: lot.id,
        },
      });
    } else {
      let allocations: { id: string; quantity: number }[];
      try {
        if (lotCode) {
          const lot = variant.lots.find((item) => item.code === lotCode);
          if (!lot || lot.quantity < input.quantity) {
            throw new LotRuleError('Este lote nao tem saldo para a saida.');
          }
          allocations = [{ id: lot.id, quantity: input.quantity }];
        } else {
          allocations = allocateFefo(
            variant.lots.map((lot) => ({
              id: lot.id,
              code: lot.code,
              quantity: lot.quantity,
              expiresOn: formatExpiryDay(lot.expiresOn),
              createdAt: lot.createdAt.toISOString(),
            })),
            input.quantity,
          );
        }
      } catch (error) {
        throw this.asLotError(error);
      }
      for (const allocation of allocations) {
        const lot = variant.lots.find((item) => item.id === allocation.id);
        if (!lot) throw new ConflictException('Lote nao encontrado.');
        await tx.distributorLot.update({
          where: { id: lot.id },
          data: { quantity: lot.quantity - allocation.quantity },
        });
        await tx.distributorMovement.create({
          data: {
            variantId: variant.id,
            direction,
            quantity: allocation.quantity,
            source: input.source,
            createdByUserId: input.userId,
            documentId: input.documentId,
            purchaseOrderId: input.purchaseOrderId,
            lotId: lot.id,
          },
        });
      }
      lotSummary = allocations
        .map((allocation) => variant.lots.find((lot) => lot.id === allocation.id)?.code)
        .filter((code): code is string => Boolean(code))
        .join(', ');
    }
    await tx.distributorBalance.update({
      where: { id: variant.balance.id },
      data: { quantity: next },
    });
    return {
      variantId: variant.id,
      productName: variant.product.name,
      label: variant.label,
      direction: input.direction,
      quantity: input.quantity,
      balance: next,
      lotSummary,
    };
  }

  private async requireDistributor(
    organizationId: string,
    role: string,
    options?: { manager?: boolean },
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, kind: true },
    });
    if (!organization || organization.kind !== OrganizationKind.DISTRIBUIDORA) {
      throw new ForbiddenException('Esta conta nao e uma distribuidora.');
    }
    if (
      options?.manager &&
      role !== 'OWNER' &&
      role !== 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Somente o gestor da distribuidora altera o cadastro.',
      );
    }
    return organization;
  }

  private async requireProduct(organizationId: string, productId: string) {
    const product = await this.prisma.distributorProduct.findFirst({
      where: { id: productId, organizationId },
    });
    if (!product) {
      throw new NotFoundException('Produto nao encontrado.');
    }
    return product;
  }

  private async requireVariant(organizationId: string, variantId: string) {
    const variant = await this.prisma.distributorVariant.findFirst({
      where: { id: variantId, product: { organizationId } },
    });
    if (!variant) {
      throw new NotFoundException('Variante nao encontrada nesta distribuidora.');
    }
    return variant;
  }

  private async requireDocument(organizationId: string, documentId: string) {
    const document = await this.prisma.distributorInboundDocument.findFirst({
      where: { id: documentId, organizationId },
      include: documentInclude,
    });
    if (!document) {
      throw new NotFoundException('Rascunho nao encontrado.');
    }
    return document;
  }

  private async requirePurchaseOrder(organizationId: string, orderId: string) {
    const order = await this.prisma.distributorPurchaseOrder.findFirst({
      where: { id: orderId, organizationId },
      include: purchaseOrderInclude,
    });
    if (!order) {
      throw new NotFoundException('Pedido nao encontrado.');
    }
    return order;
  }

  private asPurchaseConflict(error: unknown): ConflictException {
    if (error instanceof PurchaseOrderRuleError) {
      return new ConflictException(error.message);
    }
    if (error instanceof ConflictException) return error;
    throw error;
  }

  async listSellers(organizationId: string, role: string) {
    await this.requireDistributor(organizationId, role);
    const [members, ceilings] = await Promise.all([
      this.prisma.membership.findMany({
        where: { organizationId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { user: { name: 'asc' } },
      }),
      this.prisma.distributorSellerCeiling.findMany({
        where: { organizationId },
      }),
    ]);
    const byUser = new Map(ceilings.map((row) => [row.userId, row.maxDiscountBps]));
    return members.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      role: member.role,
      maxDiscountBps: byUser.get(member.userId) ?? 0,
    }));
  }

  async setSellerCeiling(
    organizationId: string,
    role: string,
    dto: SetSellerCeilingDto,
  ) {
    await this.requireDistributor(organizationId, role, { manager: true });
    const member = await this.prisma.membership.findFirst({
      where: { organizationId, userId: dto.userId },
    });
    if (!member) {
      throw new NotFoundException('Vendedor nao encontrado nesta distribuidora.');
    }
    let maxDiscountBps: number;
    try {
      maxDiscountBps = percentToBps(dto.maxDiscountPercent);
    } catch (error) {
      throw this.asQuoteError(error);
    }
    await this.prisma.distributorSellerCeiling.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: dto.userId,
        },
      },
      create: { organizationId, userId: dto.userId, maxDiscountBps },
      update: { maxDiscountBps },
    });
    return this.listSellers(organizationId, role);
  }

  async listQuotes(organizationId: string, role: string) {
    await this.requireDistributor(organizationId, role);
    const quotes = await this.prisma.distributorQuote.findMany({
      where: { organizationId },
      include: quoteInclude,
      orderBy: { createdAt: 'desc' },
    });
    return quotes.map(toQuoteView);
  }

  async createQuote(
    organizationId: string,
    role: string,
    userId: string,
    dto: CreateQuoteDto,
  ) {
    await this.requireDistributor(organizationId, role);
    const customerName = dto.customerName.trim();
    if (customerName.length < 2) {
      throw new BadRequestException('Informe o cliente do orcamento.');
    }
    let lines: Array<{
      variantId: string;
      quantity: number;
      unitPriceCents: number;
      discountBps: number;
    }>;
    try {
      lines = dto.lines.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        discountBps: percentToBps(line.discountPercent),
      }));
    } catch (error) {
      throw this.asQuoteError(error);
    }
    for (const line of lines) {
      await this.requireVariant(organizationId, line.variantId);
    }
    const ceiling = await this.prisma.distributorSellerCeiling.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    let decision: ReturnType<typeof decideQuote>;
    try {
      decision = decideQuote({
        lines,
        sellerMaxDiscountBps: ceiling?.maxDiscountBps ?? 0,
      });
    } catch (error) {
      throw this.asQuoteError(error);
    }
    const now = new Date();
    const created = await this.prisma.distributorQuote.create({
      data: {
        organizationId,
        customerName,
        sellerUserId: userId,
        status: decision.status,
        grantedCents: decision.grantedCents,
        approvedByUserId: decision.status === 'APPROVED' ? userId : null,
        approvedAt: decision.status === 'APPROVED' ? now : null,
        lines: { create: lines },
      },
      include: quoteInclude,
    });
    return toQuoteView(created);
  }

  async approveQuote(
    organizationId: string,
    role: string,
    userId: string,
    quoteId: string,
  ) {
    await this.requireDistributor(organizationId, role, { manager: true });
    const claimed = await this.prisma.distributorQuote.updateMany({
      where: { id: quoteId, organizationId, status: 'PENDING_APPROVAL' },
      data: {
        status: 'APPROVED',
        approvedByUserId: userId,
        approvedAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'Este orcamento nao esta esperando aprovacao.',
      );
    }
    return this.getQuote(organizationId, role, quoteId);
  }

  async rejectQuote(
    organizationId: string,
    role: string,
    userId: string,
    quoteId: string,
  ) {
    await this.requireDistributor(organizationId, role, { manager: true });
    const claimed = await this.prisma.distributorQuote.updateMany({
      where: { id: quoteId, organizationId, status: 'PENDING_APPROVAL' },
      data: {
        status: 'REJECTED',
        rejectedByUserId: userId,
        rejectedAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'Este orcamento nao esta esperando aprovacao.',
      );
    }
    return this.getQuote(organizationId, role, quoteId);
  }

  async discountReport(
    organizationId: string,
    role: string,
    from: string | undefined,
    to: string | undefined,
  ) {
    await this.requireDistributor(organizationId, role);
    const start = parseReportDay(from, 'inicio');
    const end = parseReportDay(to, 'fim');
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('A data final precisa ser igual ou posterior a inicial.');
    }
    const endInclusive = new Date(end);
    endInclusive.setUTCHours(23, 59, 59, 999);
    const quotes = await this.prisma.distributorQuote.findMany({
      where: {
        organizationId,
        status: 'APPROVED',
        approvedAt: { gte: start, lte: endInclusive },
      },
      include: quoteInclude,
      orderBy: { approvedAt: 'asc' },
    });
    const rows = quotes.map(toQuoteView);
    return {
      from: from?.trim(),
      to: to?.trim(),
      grantedCents: sumGrantedCents(rows),
      quotes: rows,
    };
  }

  private async getQuote(organizationId: string, role: string, quoteId: string) {
    await this.requireDistributor(organizationId, role);
    const quote = await this.prisma.distributorQuote.findFirst({
      where: { id: quoteId, organizationId },
      include: quoteInclude,
    });
    if (!quote) throw new NotFoundException('Orcamento nao encontrado.');
    return toQuoteView(quote);
  }

  private asQuoteError(error: unknown): BadRequestException {
    if (error instanceof QuoteRuleError) {
      return new BadRequestException(error.message);
    }
    throw error;
  }

  private async fiscalView(organizationId: string) {
    const [profile, cursor] = await Promise.all([
      this.prisma.distributorFiscalProfile.findUnique({ where: { organizationId } }),
      this.prisma.distributorDfeCursor.findUnique({ where: { organizationId } }),
    ]);
    const missing: string[] = [];
    if (!profile?.cnpj) missing.push('CNPJ');
    if (!profile?.uf) missing.push('UF');
    if (!profile?.certificateCipher) missing.push('Certificado A1');
    return {
      cnpj: profile?.cnpj ?? null,
      uf: profile?.uf ?? null,
      stateRegistration: profile?.stateRegistration ?? null,
      regime: profile?.regime ?? 'PRESUMIDO',
      certificateUploaded: Boolean(profile?.certificateCipher),
      lastNsu: cursor?.lastNsu ?? '0',
      signedQueryEnabled: false,
      missing,
      emissionEnabled: OUTBOUND_EMISSION_ENABLED,
      note:
        'A nota de compra entra pelo XML e pela chave de 44 digitos. A nota de saida nasce do orcamento aprovado. A busca e a autorizacao assinadas na SEFAZ permanecem desligadas sem homologacao.',
    };
  }

  async listOutboundInvoices(organizationId: string, role: string) {
    await this.requireDistributor(organizationId, role);
    const [rows, profile] = await Promise.all([
      this.prisma.distributorOutboundInvoice.findMany({
        where: { organizationId },
        include: outboundInclude,
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.distributorFiscalProfile.findUnique({ where: { organizationId } }),
    ]);
    return rows.map((row) =>
      toOutboundView(row, {
        certificateUploaded: Boolean(profile?.certificateCipher),
      }),
    );
  }

  async createOutboundFromQuote(
    organizationId: string,
    role: string,
    userId: string,
    dto: CreateOutboundFromQuoteDto,
  ) {
    await this.requireDistributor(organizationId, role);
    const profile = await this.prisma.distributorFiscalProfile.findUnique({
      where: { organizationId },
    });
    if (!profile?.cnpj || !profile.uf) {
      throw new BadRequestException(
        'Cadastre o CNPJ e a UF da distribuidora em Fiscal antes de montar a nota de saida.',
      );
    }
    const customer = validateCnpj(dto.customerCnpj);
    if (!customer.ok) throw new BadRequestException(customer.message);
    const customerUf = dto.customerUf.trim().toUpperCase();
    if (!BRAZIL_UFS.has(customerUf)) {
      throw new BadRequestException('Informe a UF do destinatario.');
    }
    const quote = await this.prisma.distributorQuote.findFirst({
      where: { id: dto.quoteId, organizationId, status: 'APPROVED' },
      include: quoteInclude,
    });
    if (!quote) {
      throw new NotFoundException('Orcamento aprovado nao encontrado.');
    }
    const existing = await this.prisma.distributorOutboundInvoice.findUnique({
      where: { quoteId: quote.id },
    });
    if (existing) {
      throw new ConflictException('Este orcamento ja gerou uma nota de saida.');
    }
    let built;
    try {
      built = buildOutboundLines({
        emitterUf: profile.uf,
        customerUf,
        lines: quote.lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          discountBps: line.discountBps,
          product: {
            name: line.variant.product.name,
            sizeLabel: line.variant.label,
            ncm: line.variant.product.ncm,
            originCode: line.variant.product.originCode,
            cest: line.variant.product.cest,
            saleCfopIn: line.variant.product.saleCfopIn,
            saleCfopOut: line.variant.product.saleCfopOut,
            icmsSt: line.variant.product.icmsSt,
          },
        })),
      });
    } catch (error) {
      throw this.asOutboundError(error);
    }
    const last = await this.prisma.distributorOutboundInvoice.findFirst({
      where: { organizationId, series: '1' },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const number = (last?.number ?? 0) + 1;
    const totalCents = built.reduce((sum, line) => sum + line.totalCents, 0);
    try {
      const created = await this.prisma.distributorOutboundInvoice.create({
        data: {
          organizationId,
          quoteId: quote.id,
          series: '1',
          number,
          customerName: quote.customerName,
          customerCnpj: customer.normalized,
          customerUf,
          emitterCnpj: profile.cnpj,
          emitterUf: profile.uf,
          totalCents,
          createdByUserId: userId,
          lines: {
            create: built.map((line) => ({
              variantId: line.variantId,
              description: line.description,
              quantity: line.quantity,
              unitPriceCents: line.unitPriceCents,
              discountBps: line.discountBps,
              ncm: line.ncm,
              cfop: line.cfop,
              originCode: line.originCode,
              cest: line.cest,
              icmsSt: line.icmsSt,
            })),
          },
        },
        include: outboundInclude,
      });
      return toOutboundView(created, {
        certificateUploaded: Boolean(profile.certificateCipher),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Este orcamento ja gerou uma nota de saida.');
      }
      throw error;
    }
  }

  async authorizeOutboundInvoice(
    organizationId: string,
    role: string,
    invoiceId: string,
  ) {
    await this.requireDistributor(organizationId, role, { manager: true });
    const [invoice, profile] = await Promise.all([
      this.prisma.distributorOutboundInvoice.findFirst({
        where: { id: invoiceId, organizationId },
        include: outboundInclude,
      }),
      this.prisma.distributorFiscalProfile.findUnique({ where: { organizationId } }),
    ]);
    if (!invoice) throw new NotFoundException('Nota de saida nao encontrada.');
    const view = toOutboundView(invoice, {
      certificateUploaded: Boolean(profile?.certificateCipher),
    });
    try {
      assertOutboundAuthorize({
        status: invoice.status,
        blockers: view.blockers,
        emissionEnabled: OUTBOUND_EMISSION_ENABLED,
      });
    } catch (error) {
      throw this.asOutboundError(error);
    }
    throw new BadRequestException(
      'A autorizacao na SEFAZ ainda nao esta ligada. Cadastre o certificado e aguarde a homologacao.',
    );
  }

  async cancelOutboundInvoice(
    organizationId: string,
    role: string,
    invoiceId: string,
  ) {
    await this.requireDistributor(organizationId, role, { manager: true });
    const claimed = await this.prisma.distributorOutboundInvoice.updateMany({
      where: { id: invoiceId, organizationId, status: 'DRAFT' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('So o rascunho da nota de saida pode ser cancelado.');
    }
    return this.getOutboundInvoice(organizationId, role, invoiceId);
  }

  private async getOutboundInvoice(
    organizationId: string,
    role: string,
    invoiceId: string,
  ) {
    await this.requireDistributor(organizationId, role);
    const [invoice, profile] = await Promise.all([
      this.prisma.distributorOutboundInvoice.findFirst({
        where: { id: invoiceId, organizationId },
        include: outboundInclude,
      }),
      this.prisma.distributorFiscalProfile.findUnique({ where: { organizationId } }),
    ]);
    if (!invoice) throw new NotFoundException('Nota de saida nao encontrada.');
    return toOutboundView(invoice, {
      certificateUploaded: Boolean(profile?.certificateCipher),
    });
  }

  private asOutboundError(error: unknown): BadRequestException {
    if (error instanceof NfeOutboundError) {
      return new BadRequestException(error.message);
    }
    throw error;
  }

  private asNfeError(error: unknown): BadRequestException {
    if (error instanceof NfeXmlError) {
      return new BadRequestException(error.message);
    }
    throw error;
  }

  private asLotError(error: unknown): BadRequestException {
    if (error instanceof LotRuleError) {
      return new BadRequestException(error.message);
    }
    throw error;
  }

  private asCatalogError(error: unknown): BadRequestException {
    if (error instanceof CatalogRuleError) {
      return new BadRequestException(error.message);
    }
    throw error;
  }
}

const CATALOG_KEYS = [
  'unitCode',
  'itemsPerBox',
  'gtin',
  'warehouseLocation',
  'costCents',
  'lengthCm',
  'widthCm',
  'heightCm',
  'netWeightKg',
  'grossWeightKg',
  'boxLengthCm',
  'boxWidthCm',
  'boxHeightCm',
  'originCode',
  'cest',
  'ncm',
  'saleCfopIn',
  'saleCfopOut',
  'buyCfopIn',
  'buyCfopOut',
  'icmsSt',
] as const satisfies readonly (keyof CatalogInput)[];

function catalogInput(dto: Partial<CatalogInput>): CatalogInput {
  const input: CatalogInput = {};
  for (const key of CATALOG_KEYS) {
    if (dto[key] !== undefined) {
      input[key] = dto[key] as never;
    }
  }
  return input;
}

const documentInclude = {
  lines: { orderBy: { description: 'asc' as const } },
} satisfies Prisma.DistributorInboundDocumentInclude;

const purchaseOrderInclude = {
  lines: {
    orderBy: { id: 'asc' as const },
    include: {
      variant: { include: { product: true } },
    },
  },
} satisfies Prisma.DistributorPurchaseOrderInclude;

const quoteInclude = {
  lines: {
    orderBy: { id: 'asc' as const },
    include: { variant: { include: { product: true } } },
  },
} satisfies Prisma.DistributorQuoteInclude;

const outboundInclude = {
  lines: {
    orderBy: { id: 'asc' as const },
    include: { variant: { include: { product: true } } },
  },
} satisfies Prisma.DistributorOutboundInvoiceInclude;

type ProductRow = Prisma.DistributorProductGetPayload<{
  include: typeof productInclude;
}>;

type DocumentRow = Prisma.DistributorInboundDocumentGetPayload<{
  include: typeof documentInclude;
}>;

function toProductView(product: ProductRow) {
  const item = measureCubage(
    product.lengthMm,
    product.widthMm,
    product.heightMm,
    product.freightDivisor,
  );
  const box = measureCubage(
    product.boxLengthMm,
    product.boxWidthMm,
    product.boxHeightMm,
    product.freightDivisor,
  );
  return {
    id: product.id,
    name: product.name,
    internalSku: product.internalSku,
    supplierSku: product.supplierSku,
    ncm: product.ncm,
    caNumber: product.caNumber,
    minQuantity: product.minQuantity,
    unitCode: product.unitCode,
    itemsPerBox: product.itemsPerBox,
    gtin: product.gtin,
    warehouseLocation: product.warehouseLocation,
    costCents: product.costCents,
    lengthCm: mmToCm(product.lengthMm),
    widthCm: mmToCm(product.widthMm),
    heightCm: mmToCm(product.heightMm),
    netWeightKg: gramsToKg(product.netWeightG),
    grossWeightKg: gramsToKg(product.grossWeightG),
    boxLengthCm: mmToCm(product.boxLengthMm),
    boxWidthCm: mmToCm(product.boxWidthMm),
    boxHeightCm: mmToCm(product.boxHeightMm),
    freightDivisor: product.freightDivisor,
    originCode: product.originCode,
    cest: product.cest,
    saleCfopIn: product.saleCfopIn,
    saleCfopOut: product.saleCfopOut,
    buyCfopIn: product.buyCfopIn,
    buyCfopOut: product.buyCfopOut,
    icmsSt: product.icmsSt,
    tracksLot: product.tracksLot,
    itemCubageM3: item?.cubageM3 ?? null,
    itemVolumetricWeightG: item?.volumetricWeightG ?? null,
    boxCubageM3: box?.cubageM3 ?? null,
    boxVolumetricWeightG: box?.volumetricWeightG ?? null,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      label: variant.label.trim() || 'Único',
      quantity: variant.balance?.quantity ?? 0,
      lots: variant.lots.map((lot) => ({
        id: lot.id,
        code: lot.code,
        quantity: lot.quantity,
        expiresOn: formatExpiryDay(lot.expiresOn),
      })),
    })),
  };
}

function mmToCm(mm: number | null): number | null {
  return mm == null ? null : mm / 10;
}

function gramsToKg(grams: number | null): number | null {
  return grams == null ? null : grams / 1000;
}

function toBalanceRow(
  product: ProductRow,
  variant: ProductRow['variants'][number],
) {
  const quantity = variant.balance?.quantity ?? 0;
  return {
    productId: product.id,
    productName: product.name,
    internalSku: product.internalSku,
    variantId: variant.id,
    label: variant.label.trim() || 'Único',
    quantity,
    minQuantity: product.minQuantity,
    unitCode: product.unitCode,
    low:
      product.minQuantity != null && quantity <= product.minQuantity,
  };
}

function toDocumentView(document: DocumentRow) {
  return {
    id: document.id,
    status: document.status,
    supplierName: document.supplierName,
    supplierCnpj: document.supplierCnpj,
    invoiceNumber: document.invoiceNumber,
    accessKey: document.accessKey,
    fileName: document.fileName,
    message:
      typeof document.extraction === 'object' &&
      document.extraction != null &&
      'message' in document.extraction
        ? String((document.extraction as { message?: unknown }).message ?? '')
        : '',
    lines: document.lines.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: line.quantity,
      unitCostCents: line.unitCostCents,
      caNumber: line.caNumber,
      ncm: line.ncm,
      cfop: line.cfop,
      variantId: line.variantId,
      lotCode: line.lotCode,
      expiresOn: formatExpiryDay(line.expiresOn),
    })),
  };
}

type PurchaseOrderRow = Prisma.DistributorPurchaseOrderGetPayload<{
  include: typeof purchaseOrderInclude;
}>;

function toPurchaseOrderView(order: PurchaseOrderRow) {
  return {
    id: order.id,
    supplierName: order.supplierName,
    status: order.status,
    createdAt: order.createdAt,
    firstApprovedByUserId: order.firstApprovedByUserId,
    secondApprovedByUserId: order.secondApprovedByUserId,
    rejectionNote: order.rejectionNote,
    lines: order.lines.map((line) => ({
      id: line.id,
      variantId: line.variantId,
      productName: line.variant.product.name,
      label: line.variant.label,
      quantity: line.quantity,
      unitCostCents: line.unitCostCents,
      lotCode: line.lotCode,
      expiresOn: formatExpiryDay(line.expiresOn),
    })),
  };
}

type QuoteRow = Prisma.DistributorQuoteGetPayload<{
  include: typeof quoteInclude;
}>;

function toQuoteView(quote: QuoteRow) {
  return {
    id: quote.id,
    customerName: quote.customerName,
    sellerUserId: quote.sellerUserId,
    status: quote.status,
    grantedCents: quote.grantedCents,
    approvedAt: quote.approvedAt,
    createdAt: quote.createdAt,
    lines: quote.lines.map((line) => ({
      id: line.id,
      variantId: line.variantId,
      productName: line.variant.product.name,
      label: line.variant.label,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      discountBps: line.discountBps,
    })),
  };
}

type OutboundRow = Prisma.DistributorOutboundInvoiceGetPayload<{
  include: typeof outboundInclude;
}>;

function toOutboundView(
  invoice: OutboundRow,
  opts: { certificateUploaded: boolean },
) {
  const blockers =
    invoice.status === 'DRAFT'
      ? outboundBlockers({
          emitterCnpj: invoice.emitterCnpj,
          emitterUf: invoice.emitterUf,
          certificateUploaded: opts.certificateUploaded,
          lines: invoice.lines,
        })
      : [];
  return {
    id: invoice.id,
    quoteId: invoice.quoteId,
    status: invoice.status,
    series: invoice.series,
    number: invoice.number,
    customerName: invoice.customerName,
    customerCnpj: invoice.customerCnpj,
    customerUf: invoice.customerUf,
    emitterCnpj: invoice.emitterCnpj,
    emitterUf: invoice.emitterUf,
    totalCents: invoice.totalCents,
    accessKey: invoice.accessKey,
    protocol: invoice.protocol,
    createdAt: invoice.createdAt,
    cancelledAt: invoice.cancelledAt,
    readyToAuthorize: invoice.status === 'DRAFT' && blockers.length === 0,
    blockers,
    emissionEnabled: OUTBOUND_EMISSION_ENABLED,
    lines: invoice.lines.map((line) => ({
      id: line.id,
      variantId: line.variantId,
      description: line.description,
      productName: line.variant.product.name,
      label: line.variant.label,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      discountBps: line.discountBps,
      ncm: line.ncm,
      cfop: line.cfop,
      originCode: line.originCode,
      cest: line.cest,
      icmsSt: line.icmsSt,
      totalCents: line.unitPriceCents * line.quantity,
    })),
  };
}

function parseReportDay(value: string | undefined, label: string) {
  const trimmed = value?.trim() ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new BadRequestException(`Informe a data de ${label} como AAAA-MM-DD.`);
  }
  const day = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime())) {
    throw new BadRequestException(`Data de ${label} invalida.`);
  }
  return day;
}

function mergePurchaseLines(
  lines: CreatePurchaseOrderDto['lines'],
) {
  const byVariant = new Map<
    string,
    {
      variantId: string;
      quantity: number;
      unitCostCents: number | null;
      lotCode: string | null;
      expiresOn: Date | null;
    }
  >();
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) continue;
    let lotCode: string | null = null;
    let expiresOn: Date | null = null;
    try {
      lotCode = normalizeLotCode(line.lotCode);
      expiresOn = parseExpiryDay(line.expiresOn);
    } catch (error) {
      if (error instanceof LotRuleError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    const key = `${line.variantId}::${lotCode ?? ''}`;
    const current = byVariant.get(key);
    const cost =
      line.unitCostCents == null ? null : Math.round(line.unitCostCents);
    if (!current) {
      byVariant.set(key, {
        variantId: line.variantId,
        quantity: line.quantity,
        unitCostCents: cost,
        lotCode,
        expiresOn,
      });
      continue;
    }
    current.quantity += line.quantity;
    if (cost != null) current.unitCostCents = cost;
    if (expiresOn) current.expiresOn = expiresOn;
  }
  return [...byVariant.values()];
}

const BRAZIL_UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

function uniqueLabels(labels: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of labels) {
    const label = raw.trim();
    const key = label.toLocaleLowerCase('pt-BR');
    if (!label || seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeCa(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits || null;
}

function positiveInt(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
