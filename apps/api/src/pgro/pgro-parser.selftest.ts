/**
 * Self-test do parser PGRO (layout real de GHE).
 * Executar: npx tsx src/pgro/pgro-parser.selftest.ts
 */
import {
  expandFunctionNames,
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

APRHO do GHE 01
Riscos: Ruído, Calor, Poeira, Posturas inadequadas
Medidas: Protetor Auricular Plug, Respirador PFF2, Botina de Segurança
Notifique o superior imediato em caso de ocorrência.

Caracterização do GHE 02 – CLASSIFICAÇÃO
Setor
CLASSIFICAÇÃO
Cargo/Função
AUXILIAR DE PRODUÇÃO I,II,III
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

Caracterização do GHE 06 – APOIO ADM
APOIO ADM
AUXILIAR DE LIMPEZA
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

const expanded = expandFunctionNames('Auxiliar de Produção I,II,III');
assert(expanded.length >= 3, `expected >=3 expanded, got ${expanded.length}: ${expanded.join('|')}`);
assert(
  expanded.some((n) => /I$/i.test(n)) && expanded.some((n) => /III$/i.test(n)),
  'expand I,II,III numerals',
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
  sectorNames.some((n) => n.includes('ADMINISTRATIVO')),
  'missing ADMINISTRATIVO',
);
assert(sectorNames.some((n) => n.includes('VENDAS')), 'missing VENDAS');
assert(sectorNames.some((n) => n.includes('TORREFA')), 'missing TORREFACAO');
assert(sectorNames.length >= 7, `expected >=7 sectors, got ${sectorNames.length}`);

assert(
  !result.sectors.some((s) => /executar|descricao|es$/i.test(s.name)),
  'junk sector present',
);

const fnNames = result.functions.map((f) => f.name);
assert(
  fnNames.some((n) => /Encarregado de Produ/i.test(n)),
  'missing Encarregado',
);
assert(
  fnNames.some((n) => /Auxiliar Administrativo II/i.test(n)),
  'missing Auxiliar Administrativo II',
);
assert(
  !fnNames.some((n) => /Executar outras|Descri|Notifique|função e as|Riscos:|Luva de|Cinta|Colisão$/i.test(n)),
  `junk function: ${fnNames.join(' | ')}`,
);
assert(fnNames.length >= 12, `too few functions: ${fnNames.length}`);
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
      functions: result.functions.map((f) => f.name),
      risks: result.risks.map((r) => r.name),
      epis: result.epiNeeds.map((e) => e.suggestedName),
      warnings: result.warnings.slice(0, 8),
    },
    null,
    2,
  ),
);
