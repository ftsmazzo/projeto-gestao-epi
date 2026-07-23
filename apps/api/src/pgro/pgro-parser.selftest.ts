/**
 * Self-test do parser PGRO (05.4.3 — layout real PDF: multilinha, prosa, mesma linha).
 * Executar: npx tsx src/pgro/pgro-parser.selftest.ts
 */
import {
  expandFunctionNames,
  mergeBrokenJobTitleLines,
  normalizeFunctionDisplayName,
  normalizeFunctionKey,
  parsePgroText,
} from './pgro-parser';

/** Trechos no formato real extraído de files/PGRO.pdf e files/PGRO2.pdf */
const SAMPLE_REAL = `
Razão Social: Amendo Healthy Industria E Comercio De Amendoim Ltda
CNPJ: 27.090.425/0001-95
Município: Catanduva Estado: SP
CNAE: 10.31-7-00
Grau de Risco: 3
Nº Funcionários: 12

Caracterização do GHE 01 – Encarregado de Produção
Setor Cargo/Função Descrição da Atividade Descrição do Ambiente
PRODUÇÃO
ENCARREGADO
DE PRODUÇÃO
O encarregado de produção é o profissional responsável por supervisionar todo o processo de produção.
Está sob as responsabilidades de um encarregado de produção acompanhar o desempenho dos auxiliares.
Executar outras tarefas compatíveis com as exigências para o exercício da função.
TRABALHAM EM AMBIENTE
INTERNO E VENTILADO
APRHO do GHE 01 – Encarregado de Produção
Ruído, Calor, Poeira
Protetor Auricular Plug

Caracterização do GHE 02 – Auxiliar de Produção I,II,III/Assistente de Produção I,II/Auxiliar de Produção I,II,III
Setor Cargo/Função Descrição da Atividade Descrição do Ambiente
PRODUÇÃO
AUXILIAR DE PRODUÇÃO (I, II, III)
Auxilia na máquina de torrefação, para possibilitar a preparação da matéria prima.
Executar outras tarefas compatíveis com as exigências para o exercício da função.
TRABALHAM EM AMBIENTE
INTERNO E VENTILADO
ASSISTENTE DE PRODUÇÃO I, II
CLASSIFICAÇÃO
AUXILIAR DE PRODUÇÃO (I, II, III)
Responsáveis em separar os grãos de amendoim por diferente coloração.
APRHO do GHE 02 – Auxiliar de Produção I,II,III/Assistente de Produção I,II/Auxiliar de Produção I,II,III
Ruído, Corte/perfuração
Luva de Vaqueta

Caracterização do GHE 03 – Auxiliar Administrativo/Auxiliar Administrativo I/Auxiliar Administrativo II
Setor Cargo/Função Descrição da Atividade Descrição do Ambiente
ADMINISTRATIVO
AUXILIAR
ADMINISTRATIVO
O Auxiliar Administrativo é o profissional que presta assistência na área administrativa.
TRABALHAM EM AMBIENTE
INTERNO E CLIMATIZADO
AUXILIAR
ADMINISTRATIVO I
AUXILIAR
ADMINISTRATIVO II
APRHO do GHE 03 – Auxiliar Administrativo
Posturas Inadequadas, Fatores psicossociais
Cinta Lombar

Caracterização do GHE 04 – Vendedor Externo
VENDAS
VENDEDOR EXTERNO
Um vendedor externo é o profissional responsável por executar atividades relacionadas a venda.
TRABALHOS EXTERNOS
EM DIVERSOS LOCAIS E ESTADOS
APRHO do GHE 04 – Vendedor Externo
Acidente de trânsito, Colisão/atropelamento

Caracterização do GHE 05 – Motorista Carreteiro
TRANSPORTE
MOTORISTA CARRETEIRO
Realização de transporte de produtos e ativos entre as empresas.
APRHO do GHE 05 – Motorista Carreteiro
Colisão/atropelamento

Caracterização do GHE 06 – Auxiliar de Limpeza
Setor Cargo/Função Descrição da Atividade Descrição do Ambiente
APOIO ADM AUXILIAR DE LIMPEZA
Está sob as responsabilidades de um Auxiliar de Limpeza limpar e arrumar todo o local.
APRHO do GHE 06 – Auxiliar de Limpeza
Agentes biológicos, Produto químico

Caracterização do GHE 07 – Operador de Torrefação / Auxiliar de Torrefação
TORREFAÇÃO
OPERADOR DE TORREFAÇÃO
Operar máquina de torrefação, para possibilitar a preparação da matéria prima.
TRABALHAM EM AMBIENTE
INTERNO E VENTILADO
AUXILIAR DE TORREFAÇÃO
Auxilia na máquina de torrefação.
APRHO do GHE 07 – Operador de Torrefação / Auxiliar de Torrefação
Calor, Poeira
Avental de Raspa
`;

const SAMPLE_PGRO2 = `
Caracterização do GHE 01 – Diretor
ADMINISTRATIVO
DIRETOR
Realizar a definição da política financeira para tomadas de decisão.
BALCÃO DE ATENDIMENTO
APRHO do GHE 01 – Diretor

Caracterização do GHE 02 – Técnico de Manutenção/Ajudante de Instalação Técnica/Instalador Técnico
PRODUÇÃO
TÉCNICO DE
MANUTENÇÃO
Selecionam os materiais (portões) e fazem a entrega e a instalação.
TRABALHAM EM
AMBIENTE INTERNO
E EXTERNOS
PRODUÇÃO
AJUDANTE DE
INSTALAÇÃO
TÉCNICA
Selecionam os materiais (portões) e fazem a entrega.
PRODUÇÃO
INSTALADOR
TÉCNICO
Selecionam os materiais (portões) e fazem a entrega.
APRHO do GHE 02 – Técnico de Manutenção

Caracterização do GHE 03 – Vendedor Técnico
VENDAS
VENDEDOR
TÉCNICO
Diariamente prospecta o mercado de atuação da sua área de negócio.
APRHO do GHE 03 – Vendedor Técnico

Caracterização do GHE 04 – Motorista de Caminhão
TRANSPORTE MOTORISTA DE CAMINHÃO
Realização de transporte.
APRHO do GHE 04 – Motorista de Caminhão
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

// --- Normalização I,II,III ---
const expanded = expandFunctionNames('Auxiliar de Produção I,II,III');
assert(expanded.length === 1, `expected 1 function for I,II,III, got ${expanded.length}`);
assert(/I.*II.*III/i.test(expanded[0]), `roman preserved: ${expanded[0]}`);
assert(
  normalizeFunctionKey('AUXILIAR DE PRODUÇÃO (I, II, III)') ===
    normalizeFunctionKey('AUXILIAR DE PRODUÇÃO I,II,III'),
  'normalizeFunctionKey equate variants',
);
assert(
  /\(I, II, III\)/i.test(normalizeFunctionDisplayName('AUXILIAR DE PRODUÇÃO I,II,III')),
  'display wrap roman list',
);

assert(
  mergeBrokenJobTitleLines(['ENCARREGADO', 'DE PRODUÇÃO']).join('|') ===
    'ENCARREGADO DE PRODUÇÃO',
  'merge ENCARREGADO DE PRODUÇÃO',
);
assert(
  mergeBrokenJobTitleLines(['TÉCNICO DE', 'MANUTENÇÃO']).join('|') ===
    'TÉCNICO DE MANUTENÇÃO',
  'merge TÉCNICO DE MANUTENÇÃO',
);
assert(
  mergeBrokenJobTitleLines(['AJUDANTE DE', 'INSTALAÇÃO', 'TÉCNICA']).join('|') ===
    'AJUDANTE DE INSTALAÇÃO TÉCNICA',
  'merge AJUDANTE DE INSTALAÇÃO TÉCNICA',
);

const result = parsePgroText(SAMPLE_REAL);
assert(result.company.city === 'Catanduva', `city=${result.company.city}`);
assert(result.company.state === 'SP', `state=${result.company.state}`);

const sectorNames = result.sectors.map((s) => s.name.toUpperCase());
assert(sectorNames.some((n) => n.includes('PRODU')), 'missing PRODUCAO');
assert(sectorNames.some((n) => /CLASSIFIC/i.test(n)), 'missing CLASSIFICACAO');
assert(sectorNames.some((n) => /APOIO\s*ADM/i.test(n)), 'missing APOIO ADM');
assert(sectorNames.some((n) => n.includes('TORREFA')), 'missing TORREFACAO');
assert(
  !result.sectors.some((s) => /executar|descricao|trabalham|balc/i.test(s.name)),
  'junk/environment sector present',
);

const fns = result.functions;

// GHE 01 multilinha
assert(
  hasPair(fns, 'PRODUÇÃO', /ENCARREGADO DE PRODUÇÃO/i),
  'GHE01 ENCARREGADO DE PRODUCAO',
);

// GHE 02 multi-par após prosa
assert(
  hasPair(fns, 'PRODUÇÃO', /AUXILIAR DE PRODUÇÃO/i) &&
    hasPair(fns, 'PRODUÇÃO', /I.*II.*III/i),
  'GHE02 PRODUCAO + AUXILIAR',
);
assert(
  hasPair(fns, 'PRODUÇÃO', /ASSISTENTE DE PRODUÇÃO/i),
  'GHE02 PRODUCAO + ASSISTENTE',
);
assert(
  hasPair(fns, 'CLASSIFICAÇÃO', /AUXILIAR DE PRODUÇÃO/i),
  'GHE02 CLASSIFICACAO + AUXILIAR',
);

// GHE 03 cargos quebrados
assert(hasPair(fns, 'ADMINISTRATIVO', /^AUXILIAR ADMINISTRATIVO$/i), 'GHE03 base');
assert(hasPair(fns, 'ADMINISTRATIVO', /AUXILIAR ADMINISTRATIVO I$/i), 'GHE03 I');
assert(hasPair(fns, 'ADMINISTRATIVO', /AUXILIAR ADMINISTRATIVO II$/i), 'GHE03 II');

// GHE 06 mesma linha
assert(hasPair(fns, 'APOIO ADM', /AUXILIAR DE LIMPEZA/i), 'GHE06 same-line');

// GHE 07 segunda função após prosa
assert(hasPair(fns, 'TORREFAÇÃO', /OPERADOR DE TORREFAÇÃO/i), 'GHE07 operador');
assert(hasPair(fns, 'TORREFAÇÃO', /AUXILIAR DE TORREFAÇÃO/i), 'GHE07 auxiliar');

assert(
  !fns.some((n) =>
    /Executar outras|Descri|Notifique|Responsáveis em|Está sob|TRABALHAM|BALCÃO|^I, II$/i.test(
      n.name,
    ),
  ),
  `junk function: ${fns.map((f) => f.name).join(' | ')}`,
);

const sectorFnKeys = fns.map(
  (f) =>
    `${normalizeFunctionKey(f.sectorName ?? '')}::${normalizeFunctionKey(f.name)}`,
);
assert(
  new Set(sectorFnKeys).size === sectorFnKeys.length,
  `duplicates: ${sectorFnKeys.join(' | ')}`,
);

// --- PGRO2 ---
const p2 = parsePgroText(SAMPLE_PGRO2);
assert(hasPair(p2.functions, 'ADMINISTRATIVO', /DIRETOR/i), 'PGRO2 GHE01 DIRETOR');
assert(hasPair(p2.functions, 'PRODUÇÃO', /TÉCNICO DE MANUTENÇÃO/i), 'PGRO2 tecnico');
assert(
  hasPair(p2.functions, 'PRODUÇÃO', /AJUDANTE DE INSTALAÇÃO TÉCNICA/i),
  'PGRO2 ajudante',
);
assert(hasPair(p2.functions, 'PRODUÇÃO', /INSTALADOR TÉCNICO/i), 'PGRO2 instalador');
assert(hasPair(p2.functions, 'VENDAS', /VENDEDOR TÉCNICO/i), 'PGRO2 vendedor tecnico');
assert(
  hasPair(p2.functions, 'TRANSPORTE', /MOTORISTA DE CAMINHÃO/i),
  'PGRO2 motorista',
);
assert(
  !p2.sectors.some((s) => /INSTALADOR|BALCÃO|TÉCNICO$/i.test(s.name)),
  `bad sector in PGRO2: ${p2.sectors.map((s) => s.name).join(',')}`,
);

assert(result.risks.length >= 5, `too few risks: ${result.risks.length}`);
assert(result.epiNeeds.length >= 3, `too few epis: ${result.epiNeeds.length}`);

console.log('pgro-parser.selftest OK');
console.log(
  JSON.stringify(
    {
      sectors: result.sectors.map((s) => s.name),
      functions: result.functions.map((f) => ({
        setor: f.sectorName,
        funcao: f.name,
      })),
      pgro2: p2.functions.map((f) => ({
        setor: f.sectorName,
        funcao: f.name,
      })),
    },
    null,
    2,
  ),
);
