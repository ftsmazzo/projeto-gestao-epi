import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

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
};

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Limpa dados operacionais de teste do tenant.
   * Mantem Organization, Users, Memberships e base CAEPI global.
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
    };

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
      summary.auditLogs = await tx.auditLog.count({ where: { organizationId } });

      await tx.epiStockMovement.deleteMany({ where: { organizationId } });
      await tx.epiStockBalance.deleteMany({ where: { organizationId } });
      await tx.stockLocation.deleteMany({ where: { organizationId } });

      await tx.epiItemNeed.deleteMany({ where: { organizationId } });
      await tx.jobFunctionEpiRequirement.deleteMany({
        where: { organizationId },
      });
      await tx.jobFunctionRisk.deleteMany({ where: { organizationId } });

      await tx.pgroImportRun.deleteMany({ where: { organizationId } });
      await tx.clientUserMembership.deleteMany({ where: { organizationId } });
      await tx.worker.deleteMany({ where: { organizationId } });
      await tx.clientJobFunction.deleteMany({ where: { organizationId } });
      await tx.clientSector.deleteMany({ where: { organizationId } });
      await tx.operationalUnit.deleteMany({ where: { organizationId } });
      await tx.servedClient.deleteMany({ where: { organizationId } });

      await tx.epiVariant.deleteMany({ where: { organizationId } });
      await tx.epiItem.deleteMany({ where: { organizationId } });
      await tx.epiNeed.deleteMany({ where: { organizationId } });
      await tx.occupationalRisk.deleteMany({ where: { organizationId } });

      await tx.auditLog.deleteMany({ where: { organizationId } });
    });

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
