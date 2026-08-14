/**
 * Self-test merge heuristica + LLM (sem chamar API).
 * Executar: npx tsx src/pgro/pgro-llm-extract.selftest.ts
 */
import { OccupationalRiskCategory } from '@prisma/client';
import { mergePgroParseResults } from './pgro-llm-extract';
import type { PgroParseResult } from './pgro-parser';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const emptyCompany = {
  legalName: 'Empresa A',
  tradeName: null,
  cnpj: '27090425000195',
  addressLine: null,
  city: 'Catanduva',
  state: 'SP',
  cnae: null,
  riskGrade: null,
  employeeCount: null,
  rawText: null,
};

const heuristic: PgroParseResult = {
  company: emptyCompany,
  sectors: [
    {
      tempId: 's1',
      name: 'PRODUCAO',
      rawText: 'PRODUCAO',
      included: true,
      confidence: 'high',
      source: 'GHE',
      gheName: 'GHE 01',
    },
  ],
  functions: [
    {
      tempId: 'f1',
      name: 'OPERADOR',
      sectorName: 'PRODUCAO',
      activityDescription: null,
      environmentDescription: null,
      gheName: 'GHE 01',
      rawText: 'OPERADOR',
      included: true,
      confidence: 'high',
      source: 'GHE',
    },
  ],
  risks: [],
  epiNeeds: [],
  warnings: ['heuristica'],
  ignoredCandidates: [],
  textExtractable: true,
  textLength: 100,
  layout: 'UNKNOWN',
  parseMethod: 'HEURISTIC',
  structureWeak: true,
};

const llm: PgroParseResult = {
  company: {
    ...emptyCompany,
    legalName: null,
    cnae: '10.31-7-00',
  },
  sectors: [
    {
      tempId: 's2',
      name: 'MANUTENCAO',
      rawText: 'MANUTENCAO',
      included: true,
      confidence: 'low',
      source: 'KEYWORD',
      gheName: null,
    },
  ],
  functions: [
    {
      tempId: 'f2',
      name: 'ELETRICISTA',
      sectorName: 'MANUTENCAO',
      activityDescription: null,
      environmentDescription: null,
      gheName: null,
      rawText: 'ELETRICISTA',
      included: true,
      confidence: 'low',
      source: 'KEYWORD',
    },
  ],
  risks: [
    {
      tempId: 'r1',
      name: 'Ruido',
      category: OccupationalRiskCategory.FISICO,
      exposure: null,
      source: null,
      possibleDamage: null,
      riskLevel: null,
      functionNames: ['OPERADOR'],
      rawText: 'Ruido',
      included: true,
      confidence: 'low',
      extractionSource: 'KEYWORD',
      gheName: null,
    },
  ],
  epiNeeds: [
    {
      tempId: 'e1',
      extractedText: 'Protetor Auricular Plug',
      suggestedName: 'Protetor Auricular Plug',
      matchedEpiNeedId: null,
      matchedEpiNeedName: null,
      createNew: true,
      functionNames: ['OPERADOR'],
      riskNames: ['Ruido'],
      included: true,
      confidence: 'low',
      extractionSource: 'KEYWORD',
      gheName: null,
    },
  ],
  warnings: ['llm'],
  ignoredCandidates: [],
  textExtractable: true,
  textLength: 100,
  layout: 'UNKNOWN',
  parseMethod: 'HEURISTIC_PLUS_LLM',
  structureWeak: false,
};

const merged = mergePgroParseResults(heuristic, llm);

assert(merged.parseMethod === 'HEURISTIC_PLUS_LLM', 'method');
assert(merged.company.legalName === 'Empresa A', 'preserva razao heuristica');
assert(merged.company.cnae === '10.31-7-00', 'preenche cnae do llm');
assert(merged.sectors.length === 2, `setores: ${merged.sectors.length}`);
assert(merged.functions.length === 2, `funcoes: ${merged.functions.length}`);
assert(merged.risks.length === 1, 'riscos');
assert(merged.epiNeeds.length === 1, 'epis');
assert(
  merged.sectors.some((s) => s.name === 'PRODUCAO' && s.confidence === 'high'),
  'mantem high confidence',
);

console.log('pgro-llm-extract.selftest OK');
