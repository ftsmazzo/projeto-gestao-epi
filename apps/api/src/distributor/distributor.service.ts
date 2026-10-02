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
import { PrismaService } from '../prisma/prisma.service';
import { extractInvoiceFromFile } from '../portal/invoice-extract';
import { saveDistributorInboundFile } from './distributor-document.storage';
import type {
  AddDistributorVariantDto,
  CreateDistributorProductDto,
  ManualDistributorMovementDto,
  UpdateDistributorProductDto,
} from './dto/distributor.dto';

const productInclude = {
  variants: {
    orderBy: { label: 'asc' as const },
    include: { balance: true },
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
    try {
      const created = await this.prisma.distributorProduct.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          internalSku,
          supplierSku: emptyToNull(dto.supplierSku),
          ncm: emptyToNull(dto.ncm),
          caNumber: normalizeCa(dto.caNumber),
          minQuantity: dto.minQuantity ?? null,
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
    await this.prisma.distributorInboundLine.update({
      where: { id: lineId },
      data: { variantId: variantId || null },
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

  private async applyMovement(
    input: {
      organizationId: string;
      userId: string;
      variantId: string;
      direction: 'IN' | 'OUT';
      quantity: number;
      source: DistributorMovementSource;
      documentId: string | null;
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
      include: { balance: true, product: true },
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
    await tx.distributorBalance.update({
      where: { id: variant.balance.id },
      data: { quantity: next },
    });
    await tx.distributorMovement.create({
      data: {
        variantId: variant.id,
        direction:
          input.direction === 'OUT'
            ? DistributorMovementDirection.OUT
            : DistributorMovementDirection.IN,
        quantity: input.quantity,
        source: input.source,
        createdByUserId: input.userId,
        documentId: input.documentId,
      },
    });
    return {
      variantId: variant.id,
      productName: variant.product.name,
      label: variant.label,
      direction: input.direction,
      quantity: input.quantity,
      balance: next,
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
}

const documentInclude = {
  lines: { orderBy: { description: 'asc' as const } },
} satisfies Prisma.DistributorInboundDocumentInclude;

type ProductRow = Prisma.DistributorProductGetPayload<{
  include: typeof productInclude;
}>;

type DocumentRow = Prisma.DistributorInboundDocumentGetPayload<{
  include: typeof documentInclude;
}>;

function toProductView(product: ProductRow) {
  return {
    id: product.id,
    name: product.name,
    internalSku: product.internalSku,
    supplierSku: product.supplierSku,
    ncm: product.ncm,
    caNumber: product.caNumber,
    minQuantity: product.minQuantity,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      quantity: variant.balance?.quantity ?? 0,
    })),
  };
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
    label: variant.label,
    quantity,
    minQuantity: product.minQuantity,
    low:
      product.minQuantity != null && quantity <= product.minQuantity,
  };
}

function toDocumentView(document: DocumentRow) {
  return {
    id: document.id,
    status: document.status,
    supplierName: document.supplierName,
    invoiceNumber: document.invoiceNumber,
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
      variantId: line.variantId,
    })),
  };
}

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
