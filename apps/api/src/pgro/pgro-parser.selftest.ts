/**
 * Self-test do parser PGRO (05.4.2 — GHE multi-linha, setor/função, dedupe).
 * Executar: npx tsx src/pgro/pgro-parser.selftest.ts
 */
import {
  expandFunctionNames,
  normalizeFunctionDisplayName,
  normalizeFunctionKey,
  parsePgroText,
} from './pgro-parser';

const SAMPLE = `
PROGRAMA DE GERENCIAMENTO DE RISCOS OCUPACIONAIS - PGRO

Razão Social: Amendo Healthy Industria E Comercio De Amendoim Ltda
CNPJ: 27.090.425/0001-95
Endereço: Rua Exemplo, 100
Município: Catanduva Estado: SP
CNAE: 10.31-7-00
Grau de Risco: 3
Nº Funcionários: 12

Caracterização do GHE 01 – PRODUÇÃO
Setor Cargo/Função Descrição da Atividade Descrição do Ambiente
PRODUÇÃO
ENCARREGADO DE PRODUÇÃO
AUXILIAR DE PRODUÇÃO I,II,III
ASSISTENTE DE PRODUÇÃO I,II
Executar outras tarefas correlatas conforme necessidade do setor.
Ambiente de produção com máquinas e ruído.
Responsáveis em organizar o posto de trabalho.
Está sob as responsabilidades do encarregado.

APRHO do GHE 01
Riscos: Ruído, Calor, Poeira, Posturas inadequadas
Medidas: Protetor Auricular Plug, Respirador PFF2, Botina de Segurança
Notifique o superior imediato em caso de ocorrência.

Caracterização do GHE 02 – Auxiliar de Produção I,II,III/Assistente de Produção I,II/Auxiliar de Produção I,II,III
Setor: PRODUÇÃO
Função: AUXILIAR DE PRODUÇÃO (I, II, III)
Função: ASSISTENTE DE PRODUÇÃO I, II
Setor: CLASSIFICAÇÃO
Função: AUXILIAR DE PRODUÇÃO (I, II, III)
Descrição da Atividade
Classificar produtos conforme padrão.
Descrição do Ambiente
Área de classificação.

APRHO do GHE 02
Ruído, Corte/perfuração
Luva de Vaqueta, Óculos de Segurança

Caracterização do GHE 03 – ADMINISTRATIVO
ADMINISTRATIVO
AUXILIAR ADMINISTRATIVO/AUXILIAR ADMINISTRATIVO I/AUXILIAR ADMINISTRATIVO II
Atividades administrativas diversas.
Escritório climatizado.
APRHO do GHE 03
Fatores psicossociais, Posturas inadequadas
Cinta Lombar

Caracterização do GHE 04 – VENDAS
VENDAS
VENDEDOR EXTERNO
APRHO do GHE 04
Acidente de trânsito, Colisão/atropelamento

Caracterização do GHE 05 – TRANSPORTE
TRANSPORTE
MOTORISTA CARRETEIRO
APRHO do GHE 05
Colisão/atropelamento

Caracterização do GHE 06 – Auxiliar de Limpeza
Setor: APOIO ADM
Função: AUXILIAR DE LIMPEZA
APRHO do GHE 06
Agentes biológicos, Produto químico

Caracterização do GHE 07 – TORREFAÇÃO
TORREFAÇÃO
OPERADOR DE TORREFAÇÃO
AUXILIAR DE TORREFAÇÃO
APRHO do GHE 07
Calor, Poeira, Levantamento e transporte manual de peso
Avental de Raspa, Luva de Vaqueta
`;

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

function hasPair(
  functions: Array<{ name: string; sectorName: string | null }>,
  sector: string,
  functionPattern: RegExp,
): boolean {
  return functions.some(
    (f) =>
      (f.sectorName ?? '').toUpperCase().includes(sector.toUpperCase()) &&
      functionPattern.test(f.name),
  );
}

// I,II,III deve permanecer UMA função (não expandir em I / II / III)
const expanded = expandFunctionNames('Auxiliar de Produção I,II,III');
assert(
  expanded.length === 1,
  `expected 1 function for I,II,III, got ${expanded.length}: ${expanded.join('|')}`,
);
assert(
  /I.*II.*III/i.test(expanded[0]),
  `expected roman numerals preserved: ${expanded[0]}`,
);
assert(
  normalizeFunctionKey('AUXILIAR DE PRODUÇÃO (I, II, III)') ===
    normalizeFunctionKey('AUXILIAR DE PRODUÇÃO I,II,III'),
  'normalizeFunctionKey must equate I,II,III variants',
);
assert(
  /\(I, II, III\)/i.test(normalizeFunctionDisplayName('AUXILIAR DE PRODUÇÃO I,II,III')),
  'display normalize should wrap roman list',
);

const slash = expandFunctionNames(
  'Auxiliar Administrativo/Auxiliar Administrativo I/Auxiliar Administrativo II',
);
assert(slash.length === 3, `slash split expected 3, got ${slash.length}`);

const result = parsePgroText(SAMPLE);
assert(result.company.city === 'Catanduva', `city=${result.company.city}`);
assert(result.company.state === 'SP', `state=${result.company.state}`);
assert(!!result.company.cnae?.includes('10.31'), `cnae=${result.company.cnae}`);
assert(result.company.riskGrade === '3', `riskGrade=${result.company.riskGrade}`);
assert(result.company.employeeCount === 12, `employees=${result.company.employeeCount}`);

const sectorNames = result.sectors.map((s) => s.name.toUpperCase());
assert(
  sectorNames.some((n) => n.includes('PRODU')),
  `sectors missing PRODUCAO: ${sectorNames.join(',')}`,
);
assert(
  sectorNames.some((n) => /CLASSIFIC/i.test(n)),
  `missing CLASSIFICACAO: ${sectorNames.join(',')}`,
);
assert(
  sectorNames.some((n) => n.includes('ADMINISTRATIVO')),
  'missing ADMINISTRATIVO',
);
assert(sectorNames.some((n) => n.includes('VENDAS')), 'missing VENDAS');
assert(sectorNames.some((n) => /APOIO\s*ADM/i.test(n)), `missing APOIO ADM: ${sectorNames.join(',')}`);
assert(sectorNames.some((n) => n.includes('TORREFA')), 'missing TORREFACAO');
assert(sectorNames.length >= 7, `expected >=7 sectors, got ${sectorNames.length}`);

assert(
  !result.sectors.some((s) => /executar|descricao|es$/i.test(s.name)),
  'junk sector present',
);

const fns = result.functions;

// --- Casos obrigatórios GHE 02 (amostra isolada, sem GHE 01) ---
const ghe02Only = parsePgroText(`
Caracterização do GHE 02 – Auxiliar de Produção I,II,III/Assistente de Produção I,II/Auxiliar de Produção I,II,III
Setor: PRODUÇÃO
Função: AUXILIAR DE PRODUÇÃO (I, II, III)
Função: ASSISTENTE DE PRODUÇÃO I, II
Setor: CLASSIFICAÇÃO
Função: AUXILIAR DE PRODUÇÃO (I, II, III)
Descrição da Atividade
Classificar produtos conforme padrão.
Executar outras tarefas correlatas.
APRHO do GHE 02
Ruído
`);
assert(
  ghe02Only.functions.length === 3,
  `GHE02 isolado esperado 3 pares, got ${ghe02Only.functions.length}: ${JSON.stringify(ghe02Only.functions)}`,
);
assert(
  hasPair(ghe02Only.functions, 'PRODUÇÃO', /AUXILIAR DE PRODUÇÃO/i) &&
    hasPair(ghe02Only.functions, 'PRODUÇÃO', /I.*II.*III/i),
  'GHE02 isolado: PRODUCAO + AUXILIAR DE PRODUCAO (I,II,III)',
);
assert(
  hasPair(ghe02Only.functions, 'PRODUÇÃO', /ASSISTENTE DE PRODUÇÃO/i),
  'GHE02 isolado: PRODUCAO + ASSISTENTE DE PRODUCAO',
);
assert(
  hasPair(ghe02Only.functions, 'CLASSIFICAÇÃO', /AUXILIAR DE PRODUÇÃO/i),
  'GHE02 isolado: CLASSIFICACAO + AUXILIAR DE PRODUCAO',
);
assert(
  !ghe02Only.functions.some((f) => /Executar outras|Classificar produtos/i.test(f.name)),
  'GHE02 isolado nao deve cadastrar descricao de atividade',
);

// Mesma função em setores diferentes deve permanecer (amostra completa)
const auxiliarPairs = fns.filter((f) =>
  normalizeFunctionKey(f.name).includes('auxiliar de producao'),
);
const auxiliarSectors = new Set(
  auxiliarPairs.map((f) => (f.sectorName ?? '').toUpperCase()),
);
assert(
  auxiliarSectors.has('PRODUÇÃO') &&
    [...auxiliarSectors].some((s) => /CLASSIFIC/i.test(s)),
  `same function must exist in PRODUCAO and CLASSIFICACAO: ${[...auxiliarSectors].join(',')}`,
);

// --- Caso obrigatório GHE 06 (isolado) ---
const ghe06Only = parsePgroText(`
Caracterização do GHE 06 – Auxiliar de Limpeza
Setor: APOIO ADM
Função: AUXILIAR DE LIMPEZA
APRHO do GHE 06
Agentes biológicos
`);
assert(
  ghe06Only.functions.length === 1,
  `GHE06 isolado esperado 1, got ${ghe06Only.functions.length}`,
);
assert(
  hasPair(ghe06Only.functions, 'APOIO ADM', /AUXILIAR DE LIMPEZA/i),
  `GHE06 isolado: APOIO ADM + AUXILIAR DE LIMPEZA: ${JSON.stringify(ghe06Only.functions)}`,
);
assert(
  hasPair(fns, 'APOIO ADM', /AUXILIAR DE LIMPEZA/i),
  `GHE06 na amostra completa: ${JSON.stringify(fns.filter((f) => /GHE 06/i.test(f.gheName ?? '')))}`,
);

// Anti-fragmento
assert(
  !fns.some((n) =>
    /Executar outras|Descri|Notifique|função e as|Riscos:|Luva de|Cinta|Colisão$|Responsáveis em|Está sob as responsabilidades|^I, II$/i.test(
      n.name,
    ),
  ),
  `junk function: ${fns.map((f) => f.name).join(' | ')}`,
);

// Não expandir I/II/III em cadastros separados
assert(
  !fns.some((f) => /^I$/i.test(f.name.trim()) || /^II$/i.test(f.name.trim()) || /^III$/i.test(f.name.trim())),
  'roman numeral fragments must not become functions',
);

// Sem duplicidade exata no mesmo setor
const sectorFnKeys = fns.map(
  (f) =>
    `${normalizeFunctionKey(f.sectorName ?? '')}::${normalizeFunctionKey(f.name)}`,
);
assert(
  new Set(sectorFnKeys).size === sectorFnKeys.length,
  `exact duplicates in same sector: ${sectorFnKeys.join(' | ')}`,
);

assert(
  fns.some((n) => /Encarregado de Produ/i.test(n.name)),
  'missing Encarregado',
);
assert(
  fns.some((n) => /Auxiliar Administrativo II/i.test(n.name)),
  'missing Auxiliar Administrativo II',
);
assert(fns.length >= 10, `too few functions: ${fns.length}`);
assert(result.risks.length >= 8, `too few risks: ${result.risks.length}`);
assert(result.epiNeeds.length >= 5, `too few epis: ${result.epiNeeds.length}`);
assert(
  !result.risks.some((r) => /Notifique/i.test(r.name)),
  'false positive risk Notifique',
);

console.log('pgro-parser.selftest OK');
console.log(
  JSON.stringify(
    {
      city: result.company.city,
      state: result.company.state,
      cnae: result.company.cnae,
      sectors: result.sectors.map((s) => s.name),
      functions: result.functions.map((f) => ({
        setor: f.sectorName,
        funcao: f.name,
        ghe: f.gheName,
      })),
      risks: result.risks.map((r) => r.name),
      epis: result.epiNeeds.map((e) => e.suggestedName),
      warnings: result.warnings.slice(0, 8),
      ignored: result.ignoredCandidates.slice(0, 8),
    },
    null,
    2,
  ),
);
