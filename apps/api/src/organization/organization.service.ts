import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole, OrganizationContactRole } from '@prisma/client';
import { rm } from 'fs/promises';
import { join } from 'path';
import { AuditService } from '../audit/audit.service';
import { getDeliveryEvidenceRoot } from '../portal/facial-evidence.storage';
import { PrismaService } from '../prisma/prisma.service';
import { getWorkerFaceReferenceRoot } from '../workers/worker-face-reference.storage';
import type {
  CreateOrganizationContactDto,
  UpdateOrganizationContactDto,
} from './dto/organization-contact.dto';

export type HardResetSummary = {
  servedClients: number;
  workers: number;
  epiItems: number;
  epiNeeds: number;
  stockLocations: number;
  occupationalRisks: number;
  pgroImportRuns: number;
  clientUsers: number;
  auditLogs: number;
  epiDeliveries: number;
  facialReferences: number;
};

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listContacts(organizationId: string) {
    return this.prisma.organizationContact.findMany({
      where: { organizationId },
      orderBy: [{ isPrimary: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    });
  }

  async createContact(
    organizationId: string,
    userId: string,
    dto: CreateOrganizationContactDto,
  ) {
    const email = dto.email?.trim().toLowerCase() || null;
    const phone = dto.phone?.trim() || null;
    if (!email && !phone) {
      throw new BadRequestException(
        'Informe e-mail e/ou telefone (WhatsApp) para o contato.',
      );
    }

    const role = dto.role ?? OrganizationContactRole.SUPPORT;
    const isPrimary = dto.isPrimary === true;

    if (isPrimary) {
      await this.prisma.organizationContact.updateMany({
        where: { organizationId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await this.prisma.organizationContact.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        email,
        phone,
        role,
        isPrimary,
        notes: dto.notes?.trim() || null,
      },
    });

    await this.audit.log({
      action: 'organization_contact.created',
      organizationId,
      userId,
      entityType: 'OrganizationContact',
      entityId: contact.id,
      metadata: { role: contact.role, isPrimary: contact.isPrimary },
    });

    return contact;
  }

  async updateContact(
    organizationId: string,
    userId: string,
    contactId: string,
    dto: UpdateOrganizationContactDto,
  ) {
    const existing = await this.prisma.organizationContact.findFirst({
      where: { id: contactId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Contato da consultoria nao encontrado.');
    }

    const nextEmail =
      dto.email === undefined
        ? existing.email
        : dto.email?.trim().toLowerCase() || null;
    const nextPhone =
      dto.phone === undefined ? existing.phone : dto.phone?.trim() || null;
    if (!nextEmail && !nextPhone) {
      throw new BadRequestException(
        'O contato precisa ter e-mail e/ou telefone.',
      );
    }

    if (dto.isPrimary === true) {
      await this.prisma.organizationContact.updateMany({
        where: {
          organizationId,
          isPrimary: true,
          id: { not: contactId },
        },
        data: { isPrimary: false },
      });
    }

    const contact = await this.prisma.organizationContact.update({
      where: { id: contactId },
      data: {
        name: dto.name?.trim(),
        email: dto.email === undefined ? undefined : nextEmail,
        phone: dto.phone === undefined ? undefined : nextPhone,
        role: dto.role,
        isPrimary: dto.isPrimary,
        isActive: dto.isActive,
        notes:
          dto.notes === undefined ? undefined : dto.notes?.trim() || null,
      },
    });

    await this.audit.log({
      action: 'organization_contact.updated',
      organizationId,
      userId,
      entityType: 'OrganizationContact',
      entityId: contact.id,
      metadata: { role: contact.role, isPrimary: contact.isPrimary },
    });

    return contact;
  }

  async deleteContact(
    organizationId: string,
    userId: string,
    contactId: string,
  ) {
    const existing = await this.prisma.organizationContact.findFirst({
      where: { id: contactId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Contato da consultoria nao encontrado.');
    }

    await this.prisma.organizationContact.delete({ where: { id: contactId } });

    await this.audit.log({
      action: 'organization_contact.deleted',
      organizationId,
      userId,
      entityType: 'OrganizationContact',
      entityId: contactId,
      metadata: { role: existing.role, name: existing.name },
    });

    return { ok: true as const };
  }

  /**
   * Limpa dados operacionais de teste do tenant.
   * Mantem Organization, Users, Memberships, contatos e base CAEPI global.
   */
  async hardResetOperationalData(
    organizationId: string,
    userId: string,
    membershipRole: string,
    confirmation: string,
  ): Promise<HardResetSummary> {
    if (membershipRole !== MembershipRole.OWNER) {
      throw new ForbiddenException(
        'Apenas OWNER pode executar o hard reset operacional.',
      );
    }

    if (confirmation.trim().toUpperCase() !== 'RESETAR') {
      throw new BadRequestException(
        'Confirmacao invalida. Digite exatamente RESETAR para continuar.',
      );
    }

    const summary: HardResetSummary = {
      servedClients: 0,
      workers: 0,
      epiItems: 0,
      epiNeeds: 0,
      stockLocations: 0,
      occupationalRisks: 0,
      pgroImportRuns: 0,
      clientUsers: 0,
      auditLogs: 0,
      epiDeliveries: 0,
      facialReferences: 0,
    };

    try {
      await this.prisma.$transaction(async (tx) => {
        summary.workers = await tx.worker.count({ where: { organizationId } });
        summary.clientUsers = await tx.clientUserMembership.count({
          where: { organizationId },
        });
        summary.servedClients = await tx.servedClient.count({
          where: { organizationId },
        });
        summary.epiItems = await tx.epiItem.count({ where: { organizationId } });
        summary.epiNeeds = await tx.epiNeed.count({ where: { organizationId } });
        summary.stockLocations = await tx.stockLocation.count({
          where: { organizationId },
        });
        summary.occupationalRisks = await tx.occupationalRisk.count({
          where: { organizationId },
        });
        summary.pgroImportRuns = await tx.pgroImportRun.count({
          where: { organizationId },
        });
        summary.auditLogs = await tx.auditLog.count({
          where: { organizationId },
        });
        summary.epiDeliveries = await tx.epiDelivery.count({
          where: { organizationId },
        });
        summary.facialReferences = await tx.workerFacialReference.count({
          where: { organizationId },
        });

        // 1) Cadeia de entregas (FKs Restrict em worker/item/estoque)
        await tx.epiDeliveryReturnItem.deleteMany({
          where: { returnEvent: { organizationId } },
        });
        await tx.epiDeliveryReturn.deleteMany({ where: { organizationId } });
        await tx.deliveryEvidence.deleteMany({
          where: { delivery: { organizationId } },
        });
        await tx.epiDeliveryItem.deleteMany({
          where: { delivery: { organizationId } },
        });
        await tx.epiDelivery.deleteMany({ where: { organizationId } });

        // 2) Biometria (antes dos trabalhadores)
        await tx.workerFacialEnrollmentLink.deleteMany({
          where: { organizationId },
        });
        await tx.workerBiometricConsent.deleteMany({
          where: { organizationId },
        });
        await tx.workerFacialReference.deleteMany({
          where: { organizationId },
        });

        // 3) Estoque
        await tx.epiStockMovement.deleteMany({ where: { organizationId } });
        await tx.epiStockBalance.deleteMany({ where: { organizationId } });
        await tx.stockLocation.deleteMany({ where: { organizationId } });

        // 4) Estrutura / pessoas / clientes
        await tx.epiItemNeed.deleteMany({ where: { organizationId } });
        await tx.jobFunctionEpiRequirement.deleteMany({
          where: { organizationId },
        });
        await tx.jobFunctionRisk.deleteMany({ where: { organizationId } });
        await tx.pgroImportRun.deleteMany({ where: { organizationId } });
        await tx.clientUserMembership.deleteMany({ where: { organizationId } });
        await tx.communicationOutbox.deleteMany({ where: { organizationId } });
        await tx.worker.deleteMany({ where: { organizationId } });
        await tx.clientJobFunction.deleteMany({ where: { organizationId } });
        await tx.clientSector.deleteMany({ where: { organizationId } });
        await tx.operationalUnit.deleteMany({ where: { organizationId } });
        await tx.servedClient.deleteMany({ where: { organizationId } });

        // 5) Catalogo do tenant
        await tx.epiVariant.deleteMany({ where: { organizationId } });
        await tx.epiItem.deleteMany({ where: { organizationId } });
        await tx.epiNeed.deleteMany({ where: { organizationId } });
        await tx.occupationalRisk.deleteMany({ where: { organizationId } });

        await tx.auditLog.deleteMany({ where: { organizationId } });
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha desconhecida no hard reset.';
      this.logger.error(`Hard reset falhou: ${message}`);
      throw new BadRequestException(
        `Nao foi possivel concluir o hard reset: ${message.slice(0, 240)}`,
      );
    }

    // Arquivos biometricos do tenant (melhor esforco; DB ja limpo).
    await Promise.all([
      rm(join(getWorkerFaceReferenceRoot(), organizationId), {
        recursive: true,
        force: true,
      }).catch(() => undefined),
      rm(join(getDeliveryEvidenceRoot(), organizationId), {
        recursive: true,
        force: true,
      }).catch(() => undefined),
    ]);

    await this.audit.log({
      action: 'organization.hard_reset',
      organizationId,
      userId,
      entityType: 'Organization',
      entityId: organizationId,
      metadata: {
        confirmation: 'RESETAR',
        deleted: summary,
        preserved: [
          'Organization',
          'User',
          'Membership',
          'CaCertificate (global)',
        ],
      },
    });

    return summary;
  }
}
