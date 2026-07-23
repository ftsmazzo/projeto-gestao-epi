import { createHash, randomUUID } from 'crypto';
import { OccupationalRiskCategory } from '@prisma/client';
import { DEFAULT_EPI_NEED_SEEDS } from '../epi-needs/epi-need-suggest';
import { DEFAULT_OCCUPATIONAL_RISK_SEEDS } from '../client-structure/risk-seeds';

export type PgroCompanyData = {
  legalName: string | null;
  tradeName: string | null;
  cnpj: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  cnae: string | null;
  riskGrade: string | null;
  employeeCount: number | null;
  rawText: string | null;
};

export type PgroExtractedSector = {
  tempId: string;
  name: string;
  rawText: string;
  included: boolean;
};

export type PgroExtractedFunction = {
  tempId: string;
  name: string;
  sectorName: string | null;
  activityDescription: string | null;
  environmentDescription: string | null;
  gheName: string | null;
  rawText: string;
  included: boolean;
};

export type PgroExtractedRisk = {
  tempId: string;
  name: string;
  category: OccupationalRiskCategory;
  exposure: string | null;
  source: string | null;
  possibleDamage: string | null;
  riskLevel: string | null;
  functionNames: string[];
  rawText: string;
  included: boolean;
};

export type PgroExtractedEpiNeed = {
  tempId: string;
  extractedText: string;
  suggestedName: string;
  matchedEpiNeedId: string | null;
  matchedEpiNeedName: string | null;
  createNew: boolean;
  functionNames: string[];
  riskNames: string[];
  included: boolean;
};

export type PgroParseResult = {
  company: PgroCompanyData;
  sectors: PgroExtractedSector[];
  functions: PgroExtractedFunction[];
  risks: PgroExtractedRisk[];
  epiNeeds: PgroExtractedEpiNeed[];
  warnings: string[];
  textExtractable: boolean;
  textLength: number;
};

export function normalizeTextKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function splitMultiNames(raw: string): string[] {
  return raw
    .split(/\n|;|\||\/|,| e (?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g)
    .map((part) => cleanLine(part.replace(/^[-•*]\s*/, '')))
    .filter((part) => part.length >= 2 && part.length <= 120)
    .filter((part) => !/^(setor|cargo|funcao|ghe|risco|epi)\b/i.test(part));
}

function fieldAfterLabel(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*[:\\-]?\\s*([^\\n]{2,180})`,
      'i',
    );
    const match = text.match(re);
    if (match?.[1]) {
      const value = cleanLine(match[1]);
      if (value) return value;
    }
  }
  return null;
}

function extractCnpj(text: string): string | null {
  const match = text.match(
    /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/,
  );
  if (!match) return null;
  return match[1].replace(/[^\dA-Za-z]/g, '').toUpperCase();
}

function mapRiskCategory(raw: string): OccupationalRiskCategory {
  const key = normalizeTextKey(raw);
  if (key.includes('fisic')) return OccupationalRiskCategory.FISICO;
  if (key.includes('quim')) return OccupationalRiskCategory.QUIMICO;
  if (key.includes('biolog')) return OccupationalRiskCategory.BIOLOGICO;
  if (key.includes('ergon')) return OccupationalRiskCategory.ERGONOMICO;
  if (key.includes('mecan')) return OccupationalRiskCategory.MECANICO;
  if (key.includes('acident')) return OccupationalRiskCategory.ACIDENTE;
  if (key.includes('psico')) return OccupationalRiskCategory.PSICOSSOCIAL;
  return OccupationalRiskCategory.OUTROS;
}

function uniqueByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = normalizeTextKey(item.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function extractCompany(text: string): PgroCompanyData {
  const cnpj = extractCnpj(text);
  const legalName =
    fieldAfterLabel(text, [
      'Razao Social',
      'Razão Social',
      'Nome da Empresa',
      'Empresa',
      'Empregador',
    ]) ?? null;
  const tradeName =
    fieldAfterLabel(text, ['Nome Fantasia', 'Fantasia']) ?? null;
  const addressLine =
    fieldAfterLabel(text, ['Endereco', 'Endereço', 'Logradouro']) ?? null;
  const city =
    fieldAfterLabel(text, ['Municipio', 'Município', 'Cidade']) ?? null;
  let state = fieldAfterLabel(text, ['UF', 'Estado']) ?? null;
  if (state && state.length > 2) {
    const uf = state.match(/\b([A-Z]{2})\b/);
    state = uf?.[1] ?? state.slice(0, 2).toUpperCase();
  }
  const cnae = fieldAfterLabel(text, ['CNAE']) ?? null;
  const riskGrade =
    fieldAfterLabel(text, ['Grau de Risco', 'Grau de risco']) ?? null;
  const employeeRaw =
    fieldAfterLabel(text, [
      'Numero de Funcionarios',
      'Número de Funcionários',
      'Nº de trabalhadores',
      'Total de trabalhadores',
    ]) ?? null;
  const employeeCount = employeeRaw
    ? Number(employeeRaw.replace(/[^\d]/g, '')) || null
    : null;

  return {
    legalName,
    tradeName,
    cnpj,
    addressLine,
    city,
    state,
    cnae,
    riskGrade,
    employeeCount,
    rawText: legalName,
  };
}

function extractLabeledList(text: string, labels: string[]): string[] {
  const names: string[] = [];
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*[:\\-]?\\s*([^\\n]{2,300})`,
      'gi',
    );
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) != null) {
      names.push(...splitMultiNames(match[1]));
    }
  }
  return names;
}

function extractGheBlocks(text: string): Array<{
  gheName: string;
  sectorName: string | null;
  functionNames: string[];
  activity: string | null;
  environment: string | null;
  raw: string;
}> {
  const blocks: Array<{
    gheName: string;
    sectorName: string | null;
    functionNames: string[];
    activity: string | null;
    environment: string | null;
    raw: string;
  }> = [];

  const parts = text.split(/(?=GHE\s*\d+)/i);
  for (const part of parts) {
    if (!/GHE\s*\d+/i.test(part)) continue;
    const header = part.match(/GHE\s*\d+[^\n]{0,80}/i)?.[0] ?? 'GHE';
    const sectorName =
      fieldAfterLabel(part, ['Setor', 'Area', 'Área']) ?? null;
    const cargosRaw =
      fieldAfterLabel(part, [
        'Cargos',
        'Cargo',
        'Funcoes',
        'Funções',
        'Funcao',
        'Função',
      ]) ?? '';
    const functionNames = splitMultiNames(cargosRaw);
    const activity =
      fieldAfterLabel(part, [
        'Descricao da atividade',
        'Descrição da atividade',
        'Atividade',
      ]) ?? null;
    const environment =
      fieldAfterLabel(part, [
        'Descricao do ambiente',
        'Descrição do ambiente',
        'Ambiente',
      ]) ?? null;
    blocks.push({
      gheName: cleanLine(header),
      sectorName: sectorName ? cleanLine(sectorName) : null,
      functionNames,
      activity,
      environment,
      raw: part.slice(0, 500),
    });
  }
  return blocks;
}

function extractRisks(
  text: string,
  functionNames: string[],
): PgroExtractedRisk[] {
  const risks: PgroExtractedRisk[] = [];
  const textKey = normalizeTextKey(text);

  for (const seed of DEFAULT_OCCUPATIONAL_RISK_SEEDS) {
    const aliases = [seed.name, ...seed.aliases].map(normalizeTextKey);
    if (!aliases.some((alias) => textKey.includes(alias))) continue;
    risks.push({
      tempId: randomUUID(),
      name: seed.name,
      category: seed.category,
      exposure: null,
      source: null,
      possibleDamage: null,
      riskLevel: null,
      functionNames: [...functionNames],
      rawText: seed.name,
      included: true,
    });
  }

  // Category + agent lines: "Físico: Ruído"
  const catLine = text.matchAll(
    /(F[ií]sico|Qu[ií]mico|Biol[oó]gico|Ergon[oô]mico|Mec[aâ]nico|Acidente|Psicossocial)\s*[:\-]\s*([^\n]{2,120})/gi,
  );
  for (const match of catLine) {
    const category = mapRiskCategory(match[1]);
    for (const name of splitMultiNames(match[2])) {
      risks.push({
        tempId: randomUUID(),
        name,
        category,
        exposure: null,
        source: null,
        possibleDamage: null,
        riskLevel: null,
        functionNames: [...functionNames],
        rawText: match[0],
        included: true,
      });
    }
  }

  return uniqueByName(risks);
}

function extractEpiNeeds(
  text: string,
  functionNames: string[],
  riskNames: string[],
): PgroExtractedEpiNeed[] {
  const textKey = normalizeTextKey(text);
  const found: PgroExtractedEpiNeed[] = [];
  const seen = new Set<string>();

  for (const seed of DEFAULT_EPI_NEED_SEEDS) {
    const aliases = [seed.name, ...seed.aliases].map(normalizeTextKey);
    const hit = aliases.find((alias) => textKey.includes(alias));
    if (!hit) continue;
    const key = normalizeTextKey(seed.name);
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({
      tempId: randomUUID(),
      extractedText: seed.name,
      suggestedName: seed.name,
      matchedEpiNeedId: null,
      matchedEpiNeedName: null,
      createNew: true,
      functionNames: [...functionNames],
      riskNames: [...riskNames],
      included: true,
    });
  }

  return found;
}

export function parsePgroText(rawText: string): PgroParseResult {
  const warnings: string[] = [];
  const text = rawText.replace(/\r/g, '\n');
  const compact = text.replace(/[ \t]+/g, ' ').trim();
  const textExtractable = compact.replace(/\s/g, '').length >= 80;

  if (!textExtractable) {
    return {
      company: {
        legalName: null,
        tradeName: null,
        cnpj: null,
        addressLine: null,
        city: null,
        state: null,
        cnae: null,
        riskGrade: null,
        employeeCount: null,
        rawText: null,
      },
      sectors: [],
      functions: [],
      risks: [],
      epiNeeds: [],
      warnings: [
        'Este PDF parece nao ter texto extraivel. Use um PDF gerado digitalmente ou uma versao OCR.',
      ],
      textExtractable: false,
      textLength: compact.length,
    };
  }

  const company = extractCompany(text);
  if (!company.cnpj) {
    warnings.push('CNPJ da empresa nao encontrado com confianca.');
  }
  if (!company.legalName) {
    warnings.push('Razao social nao encontrada com confianca.');
  }

  const gheBlocks = extractGheBlocks(text);
  const sectorNames = [
    ...extractLabeledList(text, ['Setor', 'Setores']),
    ...gheBlocks.map((b) => b.sectorName).filter((v): v is string => !!v),
  ];

  // Fallback examples from common PGRO headings
  if (sectorNames.length === 0) {
    const section = text.match(
      /Setores?\s*[:\-]?\s*([\s\S]{10,400}?)(?:\n\s*\n|Fun[cç][oõ]|GHE|Risco)/i,
    );
    if (section?.[1]) {
      sectorNames.push(...splitMultiNames(section[1]));
    }
  }

  const sectors = uniqueByName(
    sectorNames.map((name) => ({
      tempId: randomUUID(),
      name,
      rawText: name,
      included: true,
    })),
  );

  const functionItems: PgroExtractedFunction[] = [];
  for (const block of gheBlocks) {
    for (const name of block.functionNames) {
      functionItems.push({
        tempId: randomUUID(),
        name,
        sectorName: block.sectorName,
        activityDescription: block.activity,
        environmentDescription: block.environment,
        gheName: block.gheName,
        rawText: block.raw,
        included: true,
      });
    }
  }

  const labeledFunctions = extractLabeledList(text, [
    'Cargos',
    'Cargo',
    'Funcoes',
    'Funções',
    'Funcao',
    'Função',
  ]);
  for (const name of labeledFunctions) {
    functionItems.push({
      tempId: randomUUID(),
      name,
      sectorName: null,
      activityDescription: null,
      environmentDescription: null,
      gheName: null,
      rawText: name,
      included: true,
    });
  }

  const functions = uniqueByName(functionItems);
  if (sectors.length === 0) {
    warnings.push('Nenhum setor identificado com confianca.');
  }
  if (functions.length === 0) {
    warnings.push('Nenhuma funcao/cargo identificada com confianca.');
  }

  const risks = extractRisks(
    text,
    functions.map((f) => f.name),
  );
  if (risks.length === 0) {
    warnings.push('Nenhum risco ocupacional identificado no texto.');
  }

  const epiNeeds = extractEpiNeeds(
    text,
    functions.map((f) => f.name),
    risks.map((r) => r.name),
  );
  if (epiNeeds.length === 0) {
    warnings.push(
      'Nenhum EPI necessario identificado nas medidas de controle. Voce ainda pode importar setores, funcoes e riscos.',
    );
  }

  if (gheBlocks.length === 0) {
    warnings.push(
      'Estrutura de GHE nao detectada; extracao parcial por rotulos e palavras-chave.',
    );
  }

  return {
    company,
    sectors,
    functions,
    risks,
    epiNeeds,
    warnings,
    textExtractable: true,
    textLength: compact.length,
  };
}

export function fingerprintText(text: string): string {
  return createHash('sha1').update(normalizeTextKey(text)).digest('hex');
}
