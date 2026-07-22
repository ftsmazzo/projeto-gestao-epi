import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkerStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { isValidCpf, stripCpf } from '../common/cpf';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateWorkerDto } from './dto/create-worker.dto';
import type { UpdateWorkerDto } from './dto/update-worker.dto';

@Injectable()
export class WorkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listByServedClient(organizationId: string, servedClientId: string) {
    await this.assertServedClient(organizationId, servedClientId);

    return this.prisma.worker.findMany({
      where: { organizationId, servedClientId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async getById(organizationId: string, id: string) {
    const worker = await this.prisma.worker.findFirst({
      where: { id, organizationId },
    });
    if (!worker) {
      throw new NotFoundException('Trabalhador nao encontrado.');
    }
    return worker;
  }

  async getClientLifeSummary(organizationId: string, servedClientId: string) {
    const client = await this.assertServedClient(organizationId, servedClientId);

    const [used, totalWorkers] = await Promise.all([
      this.prisma.worker.count({
        where: {
          organizationId,
          servedClientId,
          status: WorkerStatus.ACTIVE,
        },
      }),
      this.prisma.worker.count({
        where: { organizationId, servedClientId },
      }),
    ]);

    const allocated = client.allocatedLifeQuota;
    const available = Math.max(0, allocated - used);

    return {
      allocated,
      used,
      available,
      activeWorkers: used,
      totalWorkers,
    };
  }

  async create(
    organizationId: string,
    userId: string,
    servedClientId: string,
    dto: CreateWorkerDto,
  ) {
    await this.assertServedClient(organizationId, servedClientId);

    const status = dto.status ?? WorkerStatus.ACTIVE;
    const cpf = this.normalizeOptionalCpf(dto.cpf);
    const registration = this.normalizeOptionalText(dto.registration);
    const operationalUnitId = await this.resolveOperationalUnitId(
      organizationId,
      servedClientId,
      dto.operationalUnitId,
    );

    if (cpf) {
      await this.assertUniqueCpf(organizationId, cpf);
    }
    if (registration) {
      await this.assertUniqueRegistration(servedClientId, registration);
    }
    if (status === WorkerStatus.ACTIVE) {
      await this.assertLifeSlotAvailable(organizationId, servedClientId);
    }

    try {
      const worker = await this.prisma.worker.create({
        data: {
          organizationId,
          servedClientId,
          operationalUnitId,
          name: dto.name.trim(),
          cpf,
          registration,
          role: this.normalizeOptionalText(dto.role),
          department: this.normalizeOptionalText(dto.department),
          status,
          admissionDate: this.parseAdmissionDate(dto.admissionDate),
          notes: this.normalizeOptionalText(dto.notes),
        },
      });

      await this.audit.log({
        action: 'worker.created',
        organizationId,
        userId,
        entityType: 'Worker',
        entityId: worker.id,
        metadata: {
          servedClientId,
          status: worker.status,
          cpf: worker.cpf,
          registration: worker.registration,
        },
      });

      return worker;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateWorkerDto,
  ) {
    const existing = await this.getById(organizationId, id);

    const nextCpf =
      dto.cpf === undefined
        ? existing.cpf
        : this.normalizeOptionalCpf(dto.cpf);
    const nextRegistration =
      dto.registration === undefined
        ? existing.registration
        : this.normalizeOptionalText(dto.registration);
    const nextStatus = dto.status ?? existing.status;

    const nextUnitId =
      dto.operationalUnitId === undefined
        ? existing.operationalUnitId
        : await this.resolveOperationalUnitId(
            organizationId,
            existing.servedClientId,
            dto.operationalUnitId,
          );

    if (nextCpf && nextCpf !== existing.cpf) {
      await this.assertUniqueCpf(organizationId, nextCpf, id);
    }
    if (nextRegistration && nextRegistration !== existing.registration) {
      await this.assertUniqueRegistration(
        existing.servedClientId,
        nextRegistration,
        id,
      );
    }

    const becomingActive =
      nextStatus === WorkerStatus.ACTIVE &&
      existing.status !== WorkerStatus.ACTIVE;
    if (becomingActive) {
      await this.assertLifeSlotAvailable(
        organizationId,
        existing.servedClientId,
      );
    }

    try {
      const worker = await this.prisma.worker.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          cpf: dto.cpf === undefined ? undefined : nextCpf,
          registration:
            dto.registration === undefined ? undefined : nextRegistration,
          role:
            dto.role === undefined
              ? undefined
              : this.normalizeOptionalText(dto.role),
          department:
            dto.department === undefined
              ? undefined
              : this.normalizeOptionalText(dto.department),
          operationalUnitId:
            dto.operationalUnitId === undefined ? undefined : nextUnitId,
          status: dto.status,
          admissionDate:
            dto.admissionDate === undefined
              ? undefined
              : this.parseAdmissionDate(dto.admissionDate),
          notes:
            dto.notes === undefined
              ? undefined
              : this.normalizeOptionalText(dto.notes),
        },
      });

      await this.audit.log({
        action: 'worker.updated',
        organizationId,
        userId,
        entityType: 'Worker',
        entityId: worker.id,
        metadata: {
          before: {
            name: existing.name,
            status: existing.status,
            cpf: existing.cpf,
            registration: existing.registration,
          },
          after: {
            name: worker.name,
            status: worker.status,
            cpf: worker.cpf,
            registration: worker.registration,
          },
        },
      });

      return worker;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async updateStatus(
    organizationId: string,
    userId: string,
    id: string,
    status: WorkerStatus,
  ) {
    const existing = await this.getById(organizationId, id);
    if (existing.status === status) {
      return existing;
    }

    if (status === WorkerStatus.ACTIVE) {
      await this.assertLifeSlotAvailable(
        organizationId,
        existing.servedClientId,
      );
    }

    const worker = await this.prisma.worker.update({
      where: { id },
      data: { status },
    });

    await this.audit.log({
      action: 'worker.status_changed',
      organizationId,
      userId,
      entityType: 'Worker',
      entityId: worker.id,
      metadata: {
        from: existing.status,
        to: worker.status,
      },
    });

    return worker;
  }

  private async assertServedClient(
    organizationId: string,
    servedClientId: string,
  ) {
    const client = await this.prisma.servedClient.findFirst({
      where: { id: servedClientId, organizationId },
      select: { id: true, allocatedLifeQuota: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente atendido nao encontrado.');
    }
    return client;
  }

  private async assertLifeSlotAvailable(
    organizationId: string,
    servedClientId: string,
  ) {
    const client = await this.assertServedClient(
      organizationId,
      servedClientId,
    );
    const used = await this.prisma.worker.count({
      where: {
        organizationId,
        servedClientId,
        status: WorkerStatus.ACTIVE,
      },
    });

    if (used >= client.allocatedLifeQuota) {
      throw new BadRequestException(
        `A cota de vidas deste cliente foi atingida (${client.allocatedLifeQuota}). Inative um trabalhador ou aumente a cota alocada.`,
      );
    }
  }

  private async resolveOperationalUnitId(
    organizationId: string,
    servedClientId: string,
    operationalUnitId?: string | null,
  ): Promise<string | null> {
    if (operationalUnitId === undefined || operationalUnitId === null) {
      return null;
    }
    const trimmed = operationalUnitId.trim();
    if (!trimmed) {
      return null;
    }

    const unit = await this.prisma.operationalUnit.findFirst({
      where: {
        id: trimmed,
        organizationId,
        servedClientId,
      },
      select: { id: true },
    });
    if (!unit) {
      throw new BadRequestException(
        'Unidade operacional invalida para este cliente atendido.',
      );
    }
    return unit.id;
  }

  private normalizeOptionalCpf(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const cpf = stripCpf(trimmed);
    if (!isValidCpf(cpf)) {
      throw new BadRequestException(
        'CPF invalido. Verifique os digitos e tente novamente.',
      );
    }
    return cpf;
  }

  private async assertUniqueCpf(
    organizationId: string,
    cpf: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.worker.findFirst({
      where: {
        organizationId,
        cpf,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ja existe um trabalhador com este CPF nesta organizacao.',
      );
    }
  }

  private async assertUniqueRegistration(
    servedClientId: string,
    registration: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.worker.findFirst({
      where: {
        servedClientId,
        registration,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ja existe um trabalhador com esta matricula neste cliente atendido.',
      );
    }
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private parseAdmissionDate(value?: string | null): Date | null {
    if (value === undefined || value === null || value.trim() === '') {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Data de admissao invalida.');
    }
    return date;
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(',')
        : String(error.meta?.target ?? '');
      if (target.includes('cpf')) {
        throw new ConflictException(
          'Ja existe um trabalhador com este CPF nesta organizacao.',
        );
      }
      if (target.includes('registration')) {
        throw new ConflictException(
          'Ja existe um trabalhador com esta matricula neste cliente atendido.',
        );
      }
      throw new ConflictException(
        'Registro duplicado. Verifique CPF e matricula.',
      );
    }
  }
}
