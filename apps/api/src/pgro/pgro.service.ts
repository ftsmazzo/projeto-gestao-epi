import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipRole,
  OccupationalRiskCategory,
  Prisma,
  PgroImportStatus,
  ServedClientStatus,
  WorkerStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { validateCnpj } from '../common/cnpj';
import { ensureMatrizOperationalUnit } from '../operational-units/matriz-unit';
import { PrismaService } from '../prisma/prisma.service';
import {
  inferOsRiskContext,
  isGenericRiskSource,
} from '../client-structure/risk-context';
import { resolveEpiNeedSeedByName } from '../epi-needs/epi-need-suggest';
import { ServedClientsService } from '../served-clients/served-clients.service';
import type { ConfirmPgroImportDto } from './dto/pgro-import.dto';
import {
  assessPgroCompanyMatch,
  buildPgroStructureDiff,
  functionKey,
  type ExistingPgroSector,
} from './pgro-diff';
import { buildExtraAliasPack, learnFromConfirm } from './pgro-learn';
import {
  extractPgroWithOpenAiText,
  mergePgroParseResults,
} from './pgro-llm-extract';
import {
  isPgroStructureWeak,
  normalizeTextKey,
  parsePgroText,
  shouldUsePgroLlmFallback,
  type PgroExtractedEpiNeed,
  type PgroParseResult,
} from './pgro-parser';
import { extractPgroDocumentText } from './pgro-text-extract';

type ConfirmOptions = {
  skipManagementRole?: boolean;
};

@Injectable()
export class PgroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly servedClients: ServedClientsService,
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
    options?: ConfirmOptions,
  ) {
    if (!options?.skipManagementRole) {
      this.assertManagementRole(membershipRole);
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo Word (.docx) ou PDF.');
    }

    let documentKind: 'PDF' | 'DOCX';
    let documentText: string;
    try {
      const extracted = await extractPgroDocumentText(file);
      documentKind = extracted.kind;
      documentText = extracted.text;
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error
          ? err.message
          : 'Formato nao suportado. Envie .docx ou PDF.',
      );
    }

    if (servedClientId) {
      await this.requireClient(organizationId, servedClientId);
    }

    const startedAt = new Date();
    let parseResult: PgroParseResult;
    try {
      const aliasRows = await this.prisma.pgroExtractionAlias.findMany({
        where: { organizationId },
        select: {
          kind: true,
          rawNormalized: true,
          canonicalName: true,
          category: true,
        },
        take: 2000,
      });
      const extraAliases = buildExtraAliasPack(aliasRows);

      parseResult = parsePgroText(documentText, { extraAliases });

      const wantsLlm = shouldUsePgroLlmFallback(parseResult);
      const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());

      if (parseResult.textExtractable && wantsLlm && !hasOpenAiKey) {
        parseResult.warnings.push(
          'Extracao automatica duvidosa (layout complexo), mas OPENAI_API_KEY nao esta configurada na API — fallback de IA nao rodou. Configure a chave no EasyPanel para melhorar o preview.',
        );
      }

      if (parseResult.textExtractable && wantsLlm && hasOpenAiKey) {
        try {
          const llmPart = await extractPgroWithOpenAiText(
            documentText,
            parseResult,
          );
          if (llmPart && llmPart.parseMethod === 'HEURISTIC_PLUS_LLM') {
            parseResult = mergePgroParseResults(parseResult, llmPart, {
              // Heuristic trouxe estrutura, mas com sinais de erro → prioriza setores/funcoes da IA.
              preferLlmStructure: !isPgroStructureWeak({
                layout: parseResult.layout,
                sectors: parseResult.sectors,
                functions: parseResult.functions,
                textExtractable: parseResult.textExtractable,
              }),
            });
            parseResult.warnings.push(
              `Fallback de IA aplicado sobre o texto do ${documentKind === 'DOCX' ? 'Word' : 'PDF'}. Revise setores e funcoes.`,
            );
          } else if (llmPart) {
            parseResult = {
              ...parseResult,
              warnings: llmPart.warnings,
            };
          }
        } catch (llmErr) {
          parseResult.warnings.push(
            `IA indisponivel na extracao: ${
              llmErr instanceof Error ? llmErr.message : String(llmErr)
            }`,
          );
        }
      }

      if (documentKind === 'DOCX') {
        parseResult.warnings.unshift(
          'Texto extraido do Word (.docx) — formato preferencial para PGR.',
        );
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const run = await this.prisma.pgroImportRun.create({
        data: {
          organizationId,
          servedClientId: servedClientId || null,
          status: PgroImportStatus.FAILED,
          fileName: file.originalname || 'pgro',
          startedAt,
          finishedAt: new Date(),
          errorMessage:
            err instanceof Error
              ? err.message
              : 'Falha ao ler o documento.',
          createdByUserId: userId,
          warnings: [
            'Nao foi possivel processar o arquivo. Prefira o .docx original do Word ou um PDF com texto selecionavel.',
          ],
          parseMeta: {
            layout: 'UNKNOWN',
            parseMethod: 'HEURISTIC',
            structureWeak: true,
            sourceFormat: documentKind,
          } as Prisma.InputJsonValue,
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

    const parseMeta = {
      layout: parseResult.layout,
      parseMethod: parseResult.parseMethod,
      structureWeak: parseResult.structureWeak,
      textLength: parseResult.textLength,
      sourceFormat: documentKind,
    };

    const run = await this.prisma.pgroImportRun.create({
      data: {
        organizationId,
        servedClientId: servedClientId || null,
        status,
        fileName: file.originalname || (documentKind === 'DOCX' ? 'pgro.docx' : 'pgro.pdf'),
        startedAt,
        finishedAt: status === PgroImportStatus.FAILED ? new Date() : null,
        companyData: parseResult.company as Prisma.InputJsonValue,
        extractedSectors: parseResult.sectors as Prisma.InputJsonValue,
        extractedFunctions: parseResult.functions as Prisma.InputJsonValue,
        extractedRisks: parseResult.risks as Prisma.InputJsonValue,
        extractedEpiNeeds: epiNeeds as Prisma.InputJsonValue,
        warnings: allWarnings as Prisma.InputJsonValue,
        parseMeta: parseMeta as Prisma.InputJsonValue,
        errorMessage: parseResult.textExtractable
          ? null
          : parseResult.warnings[0] ??
            'Este arquivo parece nao ter texto extraivel.',
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
        sourceFormat: documentKind,
        textExtractable: parseResult.textExtractable,
        layout: parseResult.layout,
        parseMethod: parseResult.parseMethod,
        structureWeak: parseResult.structureWeak,
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
    options?: ConfirmOptions,
  ) {
    if (!options?.skipManagementRole) {
      this.assertManagementRole(membershipRole);
    }
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
      sectorsReactivated: 0,
      sectorsArchived: 0,
      functionsCreated: 0,
      functionsExisting: 0,
      functionsReactivated: 0,
      functionsArchived: 0,
      workersInArchivedFunctions: 0,
      risksCreated: 0,
      risksExisting: 0,
      riskLinksCreated: 0,
      epiNeedsCreated: 0,
      epiNeedsExisting: 0,
      epiRequirementsCreated: 0,
      epiRequirementsExisting: 0,
    };

    const result = await this.prisma.$transaction(
      async (tx) => {
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
          const contactEmail = dto.company.contactEmail?.trim();
          const contactPhone = dto.company.contactPhone?.trim();
          if (contactEmail || contactPhone) {
            await tx.servedClient.update({
              where: { id: existing.id },
              data: {
                ...(contactEmail ? { contactEmail } : {}),
                ...(contactPhone ? { contactPhone } : {}),
              },
            });
          }
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
              contactEmail: dto.company.contactEmail?.trim() || null,
              contactPhone: dto.company.contactPhone?.trim() || null,
              status: ServedClientStatus.ACTIVE,
              notes: 'Criado via importacao assistida de PGRO/PGR.',
            },
          });
          servedClientId = created.id;
          summary.createdClient = true;
        }
      } else {
        await this.requireClientTx(tx, organizationId, servedClientId);
        if (!dto.skipCompanyUpdate) {
          const contactEmail = dto.company.contactEmail?.trim();
          const contactPhone = dto.company.contactPhone?.trim();
          if (contactEmail !== undefined || contactPhone !== undefined) {
            await tx.servedClient.update({
              where: { id: servedClientId },
              data: {
                ...(contactEmail !== undefined
                  ? { contactEmail: contactEmail || null }
                  : {}),
                ...(contactPhone !== undefined
                  ? { contactPhone: contactPhone || null }
                  : {}),
              },
            });
          }
        }
      }

      summary.servedClientId = servedClientId!;

      const clientForMatriz = await tx.servedClient.findFirst({
        where: { id: servedClientId!, organizationId },
        select: {
          id: true,
          legalName: true,
          tradeName: true,
          cnpj: true,
        },
      });
      if (clientForMatriz) {
        const matriz = await ensureMatrizOperationalUnit(
          tx,
          organizationId,
          clientForMatriz,
        );
        if (matriz.created) {
          warnings.push('Unidade Matriz criada automaticamente para o cliente.');
        }
      }

      const sectorIdByName = new Map<string, string>();
      const keepSectorKeys = new Set<string>();
      const keepFunctionKeys = new Set<string>();
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
          keepSectorKeys.add(normalizeTextKey(name));
          if (!existing.isActive) {
            await tx.clientSector.update({
              where: { id: existing.id },
              data: { isActive: true },
            });
            summary.sectorsReactivated += 1;
          } else {
            summary.sectorsExisting += 1;
            warnings.push(`Setor ja existia: ${name}`);
          }
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
          keepSectorKeys.add(normalizeTextKey(name));
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
          keepSectorKeys.add(key);
          if (!existing.isActive) {
            await tx.clientSector.update({
              where: { id: existing.id },
              data: { isActive: true },
            });
            summary.sectorsReactivated += 1;
          } else {
            summary.sectorsExisting += 1;
          }
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
          keepSectorKeys.add(key);
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
          keepSectorKeys.add(normalizeTextKey(name));
          if (!existing.isActive) {
            await tx.clientSector.update({
              where: { id: existing.id },
              data: { isActive: true },
            });
            summary.sectorsReactivated += 1;
          }
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
        keepSectorKeys.add(normalizeTextKey(name));
        summary.sectorsCreated += 1;
        warnings.push(
          'Funcoes sem setor foram vinculadas ao setor "Geral".',
        );
        return created.id;
      };

      const jobIdByName = new Map<string, string>();
      const rememberJob = (
        name: string,
        sectorName: string | null,
        id: string,
      ) => {
        jobIdByName.set(normalizeTextKey(name), id);
        jobIdByName.set(functionKey(sectorName, name), id);
      };
      for (const fn of dto.functions.filter((f) => f.included)) {
        const name = fn.name.trim();
        let sectorId: string | null = null;
        let resolvedSectorName = fn.sectorName?.trim() || null;
        if (fn.sectorName?.trim()) {
          sectorId =
            sectorIdByName.get(normalizeTextKey(fn.sectorName.trim())) ??
            null;
        }
        if (!sectorId) {
          sectorId = await ensureDefaultSector();
          resolvedSectorName = resolvedSectorName || 'Geral';
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
          rememberJob(name, resolvedSectorName, existing.id);
          keepFunctionKeys.add(functionKey(resolvedSectorName, name));
          if (!existing.isActive) {
            await tx.clientJobFunction.update({
              where: { id: existing.id },
              data: {
                isActive: true,
                description:
                  fn.activityDescription?.trim() || existing.description,
                environmentDescription:
                  fn.environmentDescription?.trim() ||
                  existing.environmentDescription,
              },
            });
            summary.functionsReactivated += 1;
          } else {
            summary.functionsExisting += 1;
            warnings.push(`Funcao ja existia: ${name}`);
          }
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
          rememberJob(name, resolvedSectorName, created.id);
          keepFunctionKeys.add(functionKey(resolvedSectorName, name));
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
          const jobFn = dto.functions.find(
            (fn) =>
              fn.included &&
              normalizeTextKey(fn.name) === normalizeTextKey(jobName),
          );
          const inferred = inferOsRiskContext({
            agent: name,
            category: risk.category,
            jobName,
            sectorName: jobFn?.sectorName,
            activity: jobFn?.activityDescription,
            environment: jobFn?.environmentDescription,
            extractedSource: risk.source,
            extractedExposure: risk.exposure,
            extractedQuantitative: risk.possibleDamage,
          });
          const link = await tx.jobFunctionRisk.findFirst({
            where: { organizationId, jobFunctionId: jobId, riskId },
          });
          if (!link) {
            await tx.jobFunctionRisk.create({
              data: {
                organizationId,
                jobFunctionId: jobId,
                riskId,
                source: inferred.source,
                exposure: inferred.exposure,
                possibleDamage: inferred.quantitative,
              },
            });
            summary.riskLinksCreated += 1;
            continue;
          }
          if (
            isGenericRiskSource(link.source) ||
            !link.exposure?.trim() ||
            !link.possibleDamage?.trim()
          ) {
            await tx.jobFunctionRisk.update({
              where: { id: link.id },
              data: {
                source: isGenericRiskSource(link.source)
                  ? inferred.source
                  : link.source,
                exposure: link.exposure?.trim() || inferred.exposure,
                possibleDamage:
                  link.possibleDamage?.trim() || inferred.quantitative,
              },
            });
          }
        }
      }

      const epiNeedIdByName = new Map<string, string>();
      const jobIds = [...new Set(jobIdByName.values())];
      const existingReqRows =
        jobIds.length > 0
          ? await tx.jobFunctionEpiRequirement.findMany({
              where: {
                organizationId,
                jobFunctionId: { in: jobIds },
                isActive: true,
              },
              select: {
                jobFunctionId: true,
                epiNeedId: true,
                riskId: true,
              },
            })
          : [];
      const existingReqKeys = new Set(
        existingReqRows.map(
          (row) =>
            `${row.jobFunctionId}|${row.epiNeedId}|${row.riskId ?? ''}`,
        ),
      );
      const epiRequirementsToCreate: Array<{
        organizationId: string;
        jobFunctionId: string;
        epiNeedId: string;
        riskId: string | null;
        isRequired: boolean;
        quantity: number;
        source: 'PGRO';
      }> = [];

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
            const seed = resolveEpiNeedSeedByName(name);
            const created = await tx.epiNeed.create({
              data: {
                organizationId,
                name,
                category: seed?.category ?? null,
                description:
                  seed?.description ??
                  'Criada via importacao assistida de PGRO/PGR',
                usefulLifeValue: seed?.usefulLifeValue ?? null,
                usefulLifeUnit: seed?.usefulLifeUnit ?? null,
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
            const key = `${jobId}|${needId}|${riskId ?? ''}`;
            if (existingReqKeys.has(key)) {
              summary.epiRequirementsExisting += 1;
              continue;
            }
            existingReqKeys.add(key);
            epiRequirementsToCreate.push({
              organizationId,
              jobFunctionId: jobId,
              epiNeedId: needId!,
              riskId,
              isRequired: true,
              quantity: 1,
              source: 'PGRO',
            });
          }
        }
      }

      if (epiRequirementsToCreate.length > 0) {
        await tx.jobFunctionEpiRequirement.createMany({
          data: epiRequirementsToCreate,
        });
        summary.epiRequirementsCreated += epiRequirementsToCreate.length;
      }

      if (dto.archiveMissing) {
        await this.archiveMissingStructure(
          tx,
          organizationId,
          servedClientId!,
          keepSectorKeys,
          keepFunctionKeys,
          summary,
          warnings,
        );
      }

      await learnFromConfirm(
        tx,
        organizationId,
        run.id,
        dto,
        {
          sectors: (run.extractedSectors as Array<{
            tempId?: string;
            name?: string;
            rawText?: string;
          }> | null) ?? null,
          functions: (run.extractedFunctions as Array<{
            tempId?: string;
            name?: string;
            rawText?: string;
          }> | null) ?? null,
          risks: (run.extractedRisks as Array<{
            tempId?: string;
            name?: string;
            rawText?: string;
          }> | null) ?? null,
          epiNeeds: (run.extractedEpiNeeds as Array<{
            tempId?: string;
            suggestedName?: string;
            extractedText?: string;
            matchedEpiNeedId?: string | null;
          }> | null) ?? null,
        },
      );

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
      },
      {
        // PGR grande: setores + funcoes + riscos + EPIs passam dos 5s padrao.
        maxWait: 15_000,
        timeout: 120_000,
      },
    );

    await this.audit.log({
      action: 'pgro_import.confirmed',
      organizationId,
      userId,
      entityType: 'PgroImportRun',
      entityId: id,
      metadata: summary,
    });

    let initialAccess = null as Awaited<
      ReturnType<ServedClientsService['createInitialManager']>
    > | null;
    const manager = dto.initialManager;
    if (
      manager?.name?.trim() &&
      manager?.email?.trim() &&
      summary.servedClientId
    ) {
      try {
        initialAccess = await this.servedClients.createInitialManager(
          organizationId,
          userId,
          summary.servedClientId,
          {
            name: manager.name.trim(),
            email: manager.email.trim(),
            phone: manager.phone?.trim() || undefined,
          },
        );
      } catch (err) {
        warnings.push(
          `Estrutura gravada, mas o gestor do portal nao foi criado: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return {
      ...this.toDto(result),
      summary,
      confirmWarnings: warnings,
      initialAccess,
    };
  }

  async previewForClient(
    organizationId: string,
    userId: string,
    servedClientId: string,
    file: Express.Multer.File | undefined,
  ) {
    const client = await this.requirePortalClient(
      organizationId,
      servedClientId,
    );
    const run = await this.preview(
      organizationId,
      userId,
      MembershipRole.OWNER,
      file,
      servedClientId,
      { skipManagementRole: true },
    );
    const existing = await this.loadExistingStructure(
      organizationId,
      servedClientId,
    );
    const diff = buildPgroStructureDiff({
      existingSectors: existing,
      parsedSectors: this.asNamedItems(run.sectors),
      parsedFunctions: this.asNamedItems(run.functions).map((item) => ({
        name: item.name,
        sectorName: item.sectorName,
        included: item.included,
      })),
    });
    const parsedCompany = this.readCompanyJson(run.company);
    const companyAssess = assessPgroCompanyMatch({
      clientCnpj: client.cnpj,
      parsedCnpj: parsedCompany.cnpj,
    });
    const warnings = [...(run.warnings ?? [])];
    if (companyAssess.warning) warnings.push(companyAssess.warning);

    return {
      run,
      diff,
      company: {
        clientLegalName: client.legalName,
        clientCnpj: client.cnpj,
        parsedLegalName: parsedCompany.legalName,
        parsedCnpj: parsedCompany.cnpj,
        cnpjMatches: companyAssess.cnpjMatches,
        canConfirm:
          companyAssess.canConfirm && run.status === PgroImportStatus.PARSED,
      },
      warnings,
    };
  }

  async confirmForClient(
    organizationId: string,
    userId: string,
    servedClientId: string,
    runId: string,
  ) {
    const client = await this.requirePortalClient(
      organizationId,
      servedClientId,
    );
    const run = await this.prisma.pgroImportRun.findFirst({
      where: { id: runId, organizationId, servedClientId },
    });
    if (!run) {
      throw new NotFoundException('Importacao PGR nao encontrada.');
    }
    const parsedCnpj =
      run.companyData &&
      typeof run.companyData === 'object' &&
      !Array.isArray(run.companyData)
        ? String(
            (run.companyData as { cnpj?: string | null }).cnpj ?? '',
          ) || null
        : null;
    const companyAssess = assessPgroCompanyMatch({
      clientCnpj: client.cnpj,
      parsedCnpj,
    });
    if (!companyAssess.canConfirm) {
      throw new BadRequestException(
        companyAssess.warning ??
          'O CNPJ do PDF nao confere com a empresa logada.',
      );
    }

    const dto = this.dtoFromStoredRun(run, servedClientId, client);
    return this.confirm(
      organizationId,
      userId,
      MembershipRole.OWNER,
      runId,
      dto,
      { skipManagementRole: true },
    );
  }

  private dtoFromStoredRun(
    run: {
      extractedSectors: Prisma.JsonValue | null;
      extractedFunctions: Prisma.JsonValue | null;
      extractedRisks: Prisma.JsonValue | null;
      extractedEpiNeeds: Prisma.JsonValue | null;
    },
    servedClientId: string,
    client: { legalName: string; cnpj: string },
  ): ConfirmPgroImportDto {
    const sectors = Array.isArray(run.extractedSectors)
      ? run.extractedSectors
      : [];
    const functions = Array.isArray(run.extractedFunctions)
      ? run.extractedFunctions
      : [];
    const risks = Array.isArray(run.extractedRisks) ? run.extractedRisks : [];
    const epiNeeds = Array.isArray(run.extractedEpiNeeds)
      ? run.extractedEpiNeeds
      : [];

    return {
      servedClientId,
      archiveMissing: true,
      skipCompanyUpdate: true,
      company: {
        legalName: client.legalName,
        cnpj: client.cnpj,
      },
      sectors: sectors.map((item) => {
        const s = item as {
          tempId?: string;
          name?: string;
          included?: boolean;
        };
        return {
          tempId: String(s.tempId ?? s.name ?? 'sector'),
          name: String(s.name ?? '').trim(),
          included: s.included !== false,
        };
      }),
      functions: functions.map((item) => {
        const f = item as {
          tempId?: string;
          name?: string;
          sectorName?: string | null;
          activityDescription?: string | null;
          environmentDescription?: string | null;
          included?: boolean;
        };
        return {
          tempId: String(f.tempId ?? f.name ?? 'function'),
          name: String(f.name ?? '').trim(),
          sectorName: f.sectorName ?? null,
          activityDescription: f.activityDescription ?? null,
          environmentDescription: f.environmentDescription ?? null,
          included: f.included !== false,
        };
      }),
      risks: risks.map((item) => {
        const r = item as {
          tempId?: string;
          name?: string;
          category?: ConfirmPgroImportDto['risks'][number]['category'];
          functionNames?: string[];
          included?: boolean;
        };
        return {
          tempId: String(r.tempId ?? r.name ?? 'risk'),
          name: String(r.name ?? '').trim(),
          category: r.category ?? OccupationalRiskCategory.OUTROS,
          functionNames: r.functionNames ?? [],
          included: r.included !== false,
        };
      }),
      epiNeeds: epiNeeds.map((item) => {
        const e = item as {
          tempId?: string;
          suggestedName?: string;
          matchedEpiNeedId?: string | null;
          createNew?: boolean;
          functionNames?: string[];
          riskNames?: string[];
          included?: boolean;
        };
        return {
          tempId: String(e.tempId ?? e.suggestedName ?? 'epi'),
          suggestedName: String(e.suggestedName ?? '').trim(),
          matchedEpiNeedId: e.matchedEpiNeedId ?? null,
          createNew: e.createNew !== false,
          functionNames: e.functionNames ?? [],
          riskNames: e.riskNames ?? [],
          included: e.included !== false,
        };
      }),
    };
  }

  private async loadExistingStructure(
    organizationId: string,
    servedClientId: string,
  ): Promise<ExistingPgroSector[]> {
    const sectors = await this.prisma.clientSector.findMany({
      where: { organizationId, servedClientId },
      select: {
        name: true,
        isActive: true,
        operationalUnitId: true,
        jobFunctions: {
          select: {
            name: true,
            isActive: true,
            _count: {
              select: {
                workers: { where: { status: WorkerStatus.ACTIVE } },
              },
            },
          },
        },
      },
    });
    return sectors.map((sector) => ({
      name: sector.name,
      isActive: sector.isActive,
      operationalUnitId: sector.operationalUnitId,
      jobs: sector.jobFunctions.map((job) => ({
        name: job.name,
        isActive: job.isActive,
        workerCount: job._count.workers,
      })),
    }));
  }

  private async archiveMissingStructure(
    tx: Prisma.TransactionClient,
    organizationId: string,
    servedClientId: string,
    keepSectorKeys: Set<string>,
    keepFunctionKeys: Set<string>,
    summary: {
      sectorsArchived: number;
      functionsArchived: number;
      workersInArchivedFunctions: number;
    },
    warnings: string[],
  ) {
    const sectors = await tx.clientSector.findMany({
      where: { organizationId, servedClientId, operationalUnitId: null },
      include: {
        jobFunctions: {
          include: {
            _count: {
              select: {
                workers: { where: { status: WorkerStatus.ACTIVE } },
              },
            },
          },
        },
      },
    });

    for (const sector of sectors) {
      for (const job of sector.jobFunctions) {
        const key = functionKey(sector.name, job.name);
        if (keepFunctionKeys.has(key) || !job.isActive) continue;
        await tx.clientJobFunction.update({
          where: { id: job.id },
          data: { isActive: false },
        });
        summary.functionsArchived += 1;
        summary.workersInArchivedFunctions += job._count.workers;
        if (job._count.workers > 0) {
          warnings.push(
            `${job._count.workers} trabalhador(es) em "${job.name}" (${sector.name}) precisam ser realocados.`,
          );
        }
      }
    }

    for (const sector of sectors) {
      const key = normalizeTextKey(sector.name);
      if (keepSectorKeys.has(key)) continue;
      const remaining = await tx.clientJobFunction.count({
        where: { sectorId: sector.id, isActive: true },
      });
      if (remaining > 0 || !sector.isActive) continue;
      await tx.clientSector.update({
        where: { id: sector.id },
        data: { isActive: false },
      });
      summary.sectorsArchived += 1;
    }
  }

  private asNamedItems(value: unknown): Array<{
    name: string;
    sectorName?: string | null;
    included?: boolean;
  }> {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const rec = item as Record<string, unknown>;
      if (typeof rec.name !== 'string' || !rec.name.trim()) return [];
      return [
        {
          name: rec.name,
          sectorName:
            typeof rec.sectorName === 'string' ? rec.sectorName : null,
          included: rec.included !== false,
        },
      ];
    });
  }

  private readCompanyJson(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { legalName: null as string | null, cnpj: null as string | null };
    }
    const rec = value as Record<string, unknown>;
    return {
      legalName: typeof rec.legalName === 'string' ? rec.legalName : null,
      cnpj: typeof rec.cnpj === 'string' ? rec.cnpj : null,
    };
  }

  private async requirePortalClient(
    organizationId: string,
    servedClientId: string,
  ) {
    const client = await this.prisma.servedClient.findFirst({
      where: { id: servedClientId, organizationId },
      select: { id: true, legalName: true, cnpj: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente do portal nao encontrado.');
    }
    return client;
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
    parseMeta?: Prisma.JsonValue | null;
    confirmSummary: Prisma.JsonValue | null;
    errorMessage: string | null;
    createdByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const meta =
      run.parseMeta &&
      typeof run.parseMeta === 'object' &&
      !Array.isArray(run.parseMeta)
        ? (run.parseMeta as {
            layout?: string;
            parseMethod?: string;
            structureWeak?: boolean;
          })
        : null;

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
      parseMeta: meta,
      layout: meta?.layout ?? null,
      parseMethod: meta?.parseMethod ?? null,
      structureWeak: meta?.structureWeak ?? null,
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
