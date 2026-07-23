import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipRole,
  Prisma,
  PgroImportStatus,
  ServedClientStatus,
} from '@prisma/client';
import pdfParse from 'pdf-parse';
import { AuditService } from '../audit/audit.service';
import { validateCnpj } from '../common/cnpj';
import { PrismaService } from '../prisma/prisma.service';
import type { ConfirmPgroImportDto } from './dto/pgro-import.dto';
import {
  normalizeTextKey,
  parsePgroText,
  type PgroExtractedEpiNeed,
  type PgroParseResult,
} from './pgro-parser';

@Injectable()
export class PgroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertManagementRole(membershipRole: string) {
    if (
      membershipRole !== MembershipRole.OWNER &&
      membershipRole !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Apenas OWNER ou ADMIN podem importar PGRO/PGR.',
      );
    }
  }

  async preview(
    organizationId: string,
    userId: string,
    membershipRole: string,
    file: Express.Multer.File | undefined,
    servedClientId?: string | null,
  ) {
    this.assertManagementRole(membershipRole);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo PDF.');
    }
    if (
      file.mimetype &&
      !file.mimetype.includes('pdf') &&
      !file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      throw new BadRequestException('O arquivo deve ser um PDF.');
    }

    if (servedClientId) {
      await this.requireClient(organizationId, servedClientId);
    }

    const startedAt = new Date();
    let parseResult: PgroParseResult;
    try {
      const parsedPdf = await pdfParse(file.buffer);
      parseResult = parsePgroText(parsedPdf.text ?? '');
    } catch (err) {
      const run = await this.prisma.pgroImportRun.create({
        data: {
          organizationId,
          servedClientId: servedClientId || null,
          status: PgroImportStatus.FAILED,
          fileName: file.originalname || 'pgro.pdf',
          startedAt,
          finishedAt: new Date(),
          errorMessage:
            err instanceof Error
              ? err.message
              : 'Falha ao ler o PDF.',
          createdByUserId: userId,
          warnings: [
            'Nao foi possivel extrair texto do PDF. Verifique se o arquivo nao esta corrompido.',
          ],
        },
      });
      return this.toDto(run);
    }

    const epiNeeds = await this.matchEpiNeeds(
      organizationId,
      parseResult.epiNeeds,
    );

    const status = parseResult.textExtractable
      ? PgroImportStatus.PARSED
      : PgroImportStatus.FAILED;

    const allWarnings = [
      ...parseResult.warnings,
      ...parseResult.ignoredCandidates.map((item) => `Ignorado: ${item}`),
    ];

    const run = await this.prisma.pgroImportRun.create({
      data: {
        organizationId,
        servedClientId: servedClientId || null,
        status,
        fileName: file.originalname || 'pgro.pdf',
        startedAt,
        finishedAt: status === PgroImportStatus.FAILED ? new Date() : null,
        companyData: parseResult.company as Prisma.InputJsonValue,
        extractedSectors: parseResult.sectors as Prisma.InputJsonValue,
        extractedFunctions: parseResult.functions as Prisma.InputJsonValue,
        extractedRisks: parseResult.risks as Prisma.InputJsonValue,
        extractedEpiNeeds: epiNeeds as Prisma.InputJsonValue,
        warnings: allWarnings as Prisma.InputJsonValue,
        errorMessage: parseResult.textExtractable
          ? null
          : parseResult.warnings[0] ??
            'Este PDF parece nao ter texto extraivel.',
        createdByUserId: userId,
      },
    });

    await this.audit.log({
      action: 'pgro_import.previewed',
      organizationId,
      userId,
      entityType: 'PgroImportRun',
      entityId: run.id,
      metadata: {
        fileName: run.fileName,
        status: run.status,
        textExtractable: parseResult.textExtractable,
        sectors: parseResult.sectors.length,
        functions: parseResult.functions.length,
        risks: parseResult.risks.length,
        epiNeeds: epiNeeds.length,
      },
    });

    return this.toDto(run);
  }

  async getRun(organizationId: string, id: string) {
    const run = await this.prisma.pgroImportRun.findFirst({
      where: { id, organizationId },
    });
    if (!run) {
      throw new NotFoundException('Importacao PGRO nao encontrada.');
    }
    return this.toDto(run);
  }

  async confirm(
    organizationId: string,
    userId: string,
    membershipRole: string,
    id: string,
    dto: ConfirmPgroImportDto,
  ) {
    this.assertManagementRole(membershipRole);
    const run = await this.prisma.pgroImportRun.findFirst({
      where: { id, organizationId },
    });
    if (!run) {
      throw new NotFoundException('Importacao PGRO nao encontrada.');
    }
    if (run.status === PgroImportStatus.FAILED) {
      throw new BadRequestException(
        'Esta importacao falhou no preview. Corrija o PDF ou a extracao antes de confirmar.',
      );
    }
    if (run.status === PgroImportStatus.CONFIRMED) {
      throw new BadRequestException('Esta importacao ja foi confirmada.');
    }
    if (run.status !== PgroImportStatus.PARSED) {
      throw new BadRequestException(
        'Somente importacoes em status PARSED podem ser confirmadas.',
      );
    }

    const warnings: string[] = [];
    const summary = {
      servedClientId: '' as string,
      createdClient: false,
      sectorsCreated: 0,
      sectorsExisting: 0,
      functionsCreated: 0,
      functionsExisting: 0,
      risksCreated: 0,
      risksExisting: 0,
      riskLinksCreated: 0,
      epiNeedsCreated: 0,
      epiNeedsExisting: 0,
      epiRequirementsCreated: 0,
      epiRequirementsExisting: 0,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      let servedClientId =
        dto.servedClientId?.trim() || run.servedClientId || null;

      const companyLegalName = dto.company.legalName?.trim();
      const companyCnpjRaw = dto.company.cnpj?.trim();
      if (!servedClientId) {
        if (!companyLegalName || !companyCnpjRaw) {
          throw new BadRequestException(
            'Para criar o cliente, informe razao social e CNPJ na revisao.',
          );
        }
        const cnpj = this.normalizeCnpj(companyCnpjRaw);
        const existing = await tx.servedClient.findFirst({
          where: { organizationId, cnpj },
        });
        if (existing) {
          servedClientId = existing.id;
          warnings.push(
            `Cliente com CNPJ ${cnpj} ja existia; estrutura sera vinculada a ele.`,
          );
        } else {
          const quota = dto.company.allocatedLifeQuota ?? 0;
          if (quota > 0) {
            await this.assertQuotaFits(tx, organizationId, quota);
          }
          const created = await tx.servedClient.create({
            data: {
              organizationId,
              legalName: companyLegalName,
              tradeName: dto.company.tradeName?.trim() || null,
              cnpj,
              allocatedLifeQuota: quota,
              status: ServedClientStatus.ACTIVE,
              notes: 'Criado via importacao assistida de PGRO/PGR.',
            },
          });
          servedClientId = created.id;
          summary.createdClient = true;
        }
      } else {
        await this.requireClientTx(tx, organizationId, servedClientId);
      }

      summary.servedClientId = servedClientId!;

      const sectorIdByName = new Map<string, string>();
      const includedSectors = dto.sectors.filter((s) => s.included);
      for (const sector of includedSectors) {
        const name = sector.name.trim();
        const existing = await tx.clientSector.findFirst({
          where: {
            organizationId,
            servedClientId: servedClientId!,
            name: { equals: name, mode: 'insensitive' },
            operationalUnitId: null,
          },
        });
        if (existing) {
          sectorIdByName.set(normalizeTextKey(name), existing.id);
          summary.sectorsExisting += 1;
          warnings.push(`Setor ja existia: ${name}`);
        } else {
          const created = await tx.clientSector.create({
            data: {
              organizationId,
              servedClientId: servedClientId!,
              name,
              description: 'Importado do PGRO/PGR',
            },
          });
          sectorIdByName.set(normalizeTextKey(name), created.id);
          summary.sectorsCreated += 1;
        }
      }

      // Ensure sectors referenced by functions exist
      for (const fn of dto.functions.filter((f) => f.included)) {
        const sectorName = fn.sectorName?.trim();
        if (!sectorName) continue;
        const key = normalizeTextKey(sectorName);
        if (sectorIdByName.has(key)) continue;
        const existing = await tx.clientSector.findFirst({
          where: {
            organizationId,
            servedClientId: servedClientId!,
            name: { equals: sectorName, mode: 'insensitive' },
            operationalUnitId: null,
          },
        });
        if (existing) {
          sectorIdByName.set(key, existing.id);
          summary.sectorsExisting += 1;
        } else {
          const created = await tx.clientSector.create({
            data: {
              organizationId,
              servedClientId: servedClientId!,
              name: sectorName,
              description: 'Importado do PGRO/PGR (via funcao)',
            },
          });
          sectorIdByName.set(key, created.id);
          summary.sectorsCreated += 1;
        }
      }

      let defaultSectorId: string | null = null;
      const ensureDefaultSector = async () => {
        if (defaultSectorId) return defaultSectorId;
        const name = 'Geral';
        const existing = await tx.clientSector.findFirst({
          where: {
            organizationId,
            servedClientId: servedClientId!,
            name: { equals: name, mode: 'insensitive' },
            operationalUnitId: null,
          },
        });
        if (existing) {
          defaultSectorId = existing.id;
          return existing.id;
        }
        const created = await tx.clientSector.create({
          data: {
            organizationId,
            servedClientId: servedClientId!,
            name,
            description: 'Setor padrao para funcoes sem setor no PGRO',
          },
        });
        defaultSectorId = created.id;
        summary.sectorsCreated += 1;
        warnings.push(
          'Funcoes sem setor foram vinculadas ao setor "Geral".',
        );
        return created.id;
      };

      const jobIdByName = new Map<string, string>();
      for (const fn of dto.functions.filter((f) => f.included)) {
        const name = fn.name.trim();
        let sectorId: string | null = null;
        if (fn.sectorName?.trim()) {
          sectorId =
            sectorIdByName.get(normalizeTextKey(fn.sectorName.trim())) ??
            null;
        }
        if (!sectorId) {
          sectorId = await ensureDefaultSector();
          warnings.push(`Funcao com dados incompletos de setor: ${name}`);
        }

        const existing = await tx.clientJobFunction.findFirst({
          where: {
            organizationId,
            sectorId,
            name: { equals: name, mode: 'insensitive' },
          },
        });
        if (existing) {
          jobIdByName.set(normalizeTextKey(name), existing.id);
          summary.functionsExisting += 1;
          warnings.push(`Funcao ja existia: ${name}`);
        } else {
          const created = await tx.clientJobFunction.create({
            data: {
              organizationId,
              servedClientId: servedClientId!,
              sectorId,
              name,
              description: fn.activityDescription?.trim() || null,
              environmentDescription:
                fn.environmentDescription?.trim() || null,
            },
          });
          jobIdByName.set(normalizeTextKey(name), created.id);
          summary.functionsCreated += 1;
        }
      }

      const riskIdByName = new Map<string, string>();
      for (const risk of dto.risks.filter((r) => r.included)) {
        const name = risk.name.trim();
        const existing = await tx.occupationalRisk.findFirst({
          where: {
            organizationId,
            category: risk.category,
            name: { equals: name, mode: 'insensitive' },
          },
        });
        if (existing) {
          riskIdByName.set(normalizeTextKey(name), existing.id);
          summary.risksExisting += 1;
        } else {
          const created = await tx.occupationalRisk.create({
            data: {
              organizationId,
              name,
              category: risk.category,
              description: 'Importado do PGRO/PGR',
            },
          });
          riskIdByName.set(normalizeTextKey(name), created.id);
          summary.risksCreated += 1;
          warnings.push(`Risco novo criado: ${name}`);
        }

        const riskId = riskIdByName.get(normalizeTextKey(name))!;
        const targetJobs =
          risk.functionNames && risk.functionNames.length > 0
            ? risk.functionNames
            : [...jobIdByName.keys()];
        for (const jobName of targetJobs) {
          const jobId = jobIdByName.get(normalizeTextKey(jobName));
          if (!jobId) continue;
          const link = await tx.jobFunctionRisk.findFirst({
            where: { organizationId, jobFunctionId: jobId, riskId },
          });
          if (!link) {
            await tx.jobFunctionRisk.create({
              data: {
                organizationId,
                jobFunctionId: jobId,
                riskId,
                source: 'PGRO',
              },
            });
            summary.riskLinksCreated += 1;
          }
        }
      }

      const epiNeedIdByName = new Map<string, string>();
      for (const epi of dto.epiNeeds.filter((e) => e.included)) {
        let needId = epi.matchedEpiNeedId?.trim() || null;
        if (needId) {
          const existingNeed = await tx.epiNeed.findFirst({
            where: { id: needId, organizationId },
          });
          if (!existingNeed) {
            warnings.push(
              `Necessidade informada nao encontrada; sera criada: ${epi.suggestedName}`,
            );
            needId = null;
          } else {
            epiNeedIdByName.set(
              normalizeTextKey(existingNeed.name),
              existingNeed.id,
            );
            summary.epiNeedsExisting += 1;
          }
        }

        if (!needId) {
          const name = epi.suggestedName.trim();
          const existing = await tx.epiNeed.findFirst({
            where: {
              organizationId,
              name: { equals: name, mode: 'insensitive' },
            },
          });
          if (existing) {
            needId = existing.id;
            epiNeedIdByName.set(normalizeTextKey(name), existing.id);
            summary.epiNeedsExisting += 1;
          } else if (epi.createNew !== false) {
            const created = await tx.epiNeed.create({
              data: {
                organizationId,
                name,
                description: 'Criada via importacao assistida de PGRO/PGR',
              },
            });
            needId = created.id;
            epiNeedIdByName.set(normalizeTextKey(name), created.id);
            summary.epiNeedsCreated += 1;
            warnings.push(`EPI necessario sem correspondencia previa: ${name}`);
          } else {
            warnings.push(`EPI necessario ignorado (sem criacao): ${name}`);
            continue;
          }
        }

        const targetJobs =
          epi.functionNames && epi.functionNames.length > 0
            ? epi.functionNames
            : [...jobIdByName.keys()];
        const riskNames = epi.riskNames ?? [];

        for (const jobName of targetJobs) {
          const jobId = jobIdByName.get(normalizeTextKey(jobName));
          if (!jobId) continue;

          const riskIds: Array<string | null> =
            riskNames.length > 0
              ? riskNames
                  .map((rn) => riskIdByName.get(normalizeTextKey(rn)) ?? null)
                  .filter((v, i, arr) => arr.indexOf(v) === i)
              : [null];

          for (const riskId of riskIds) {
            const existingReq =
              await tx.jobFunctionEpiRequirement.findFirst({
                where: {
                  organizationId,
                  jobFunctionId: jobId,
                  epiNeedId: needId!,
                  isActive: true,
                  ...(riskId ? { riskId } : { riskId: null }),
                },
              });
            if (existingReq) {
              summary.epiRequirementsExisting += 1;
              continue;
            }
            await tx.jobFunctionEpiRequirement.create({
              data: {
                organizationId,
                jobFunctionId: jobId,
                epiNeedId: needId!,
                riskId,
                isRequired: true,
                quantity: 1,
                source: 'PGRO',
              },
            });
            summary.epiRequirementsCreated += 1;
          }
        }
      }

      const updated = await tx.pgroImportRun.update({
        where: { id: run.id },
        data: {
          status: PgroImportStatus.CONFIRMED,
          finishedAt: new Date(),
          servedClientId: servedClientId!,
          confirmSummary: summary as Prisma.InputJsonValue,
          warnings: [
            ...(((run.warnings as string[] | null) ?? []) as string[]),
            ...warnings,
          ] as Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    await this.audit.log({
      action: 'pgro_import.confirmed',
      organizationId,
      userId,
      entityType: 'PgroImportRun',
      entityId: id,
      metadata: summary,
    });

    return {
      ...this.toDto(result),
      summary,
      confirmWarnings: warnings,
    };
  }

  private async matchEpiNeeds(
    organizationId: string,
    items: PgroExtractedEpiNeed[],
  ): Promise<PgroExtractedEpiNeed[]> {
    const needs = await this.prisma.epiNeed.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, aliases: true },
    });

    return items.map((item) => {
      const suggestedKey = normalizeTextKey(item.suggestedName);
      const match = needs.find((need) => {
        const nameKey = normalizeTextKey(need.name);
        if (nameKey === suggestedKey || nameKey.includes(suggestedKey)) {
          return true;
        }
        const aliases = Array.isArray(need.aliases)
          ? need.aliases.filter((a): a is string => typeof a === 'string')
          : [];
        return aliases.some(
          (alias) => normalizeTextKey(alias) === suggestedKey,
        );
      });
      if (!match) {
        return {
          ...item,
          matchedEpiNeedId: null,
          matchedEpiNeedName: null,
          createNew: true,
        };
      }
      return {
        ...item,
        matchedEpiNeedId: match.id,
        matchedEpiNeedName: match.name,
        createNew: false,
      };
    });
  }

  private toDto(run: {
    id: string;
    organizationId: string;
    servedClientId: string | null;
    status: PgroImportStatus;
    fileName: string;
    startedAt: Date;
    finishedAt: Date | null;
    companyData: Prisma.JsonValue | null;
    extractedSectors: Prisma.JsonValue | null;
    extractedFunctions: Prisma.JsonValue | null;
    extractedRisks: Prisma.JsonValue | null;
    extractedEpiNeeds: Prisma.JsonValue | null;
    warnings: Prisma.JsonValue | null;
    confirmSummary: Prisma.JsonValue | null;
    errorMessage: string | null;
    createdByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: run.id,
      organizationId: run.organizationId,
      servedClientId: run.servedClientId,
      status: run.status,
      fileName: run.fileName,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      company: run.companyData,
      sectors: run.extractedSectors ?? [],
      functions: run.extractedFunctions ?? [],
      risks: run.extractedRisks ?? [],
      epiNeeds: run.extractedEpiNeeds ?? [],
      warnings: (run.warnings as string[] | null) ?? [],
      confirmSummary: run.confirmSummary,
      errorMessage: run.errorMessage,
      createdByUserId: run.createdByUserId,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  }

  private normalizeCnpj(value: string) {
    const result = validateCnpj(value);
    if (!result.ok) {
      throw new BadRequestException(result.message);
    }
    return result.normalized;
  }

  private async requireClient(organizationId: string, id: string) {
    const client = await this.prisma.servedClient.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente atendido nao encontrado.');
    }
  }

  private async requireClientTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ) {
    const client = await tx.servedClient.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente atendido nao encontrado.');
    }
  }

  private async assertQuotaFits(
    tx: Prisma.TransactionClient,
    organizationId: string,
    allocatedLifeQuota: number,
  ) {
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { contractedLifeQuota: true },
    });
    if (!organization) {
      throw new NotFoundException('Organizacao nao encontrada.');
    }
    const allocated = await tx.servedClient.aggregate({
      where: { organizationId, status: ServedClientStatus.ACTIVE },
      _sum: { allocatedLifeQuota: true },
    });
    const used = allocated._sum.allocatedLifeQuota ?? 0;
    if (used + allocatedLifeQuota > organization.contractedLifeQuota) {
      throw new BadRequestException(
        'Nao ha vidas disponiveis suficientes na franquia para este cliente.',
      );
    }
  }
}
