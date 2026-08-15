import assert from 'node:assert/strict';
import {
  compactMatchKey,
  expandRhAbbreviations,
  findBestJobMatch,
  findBestSectorMatch,
  scoreStructureNameMatch,
} from './worker-structure-match';

assert.equal(compactMatchKey('A C M'), 'acm');
assert.equal(compactMatchKey('ACM'), 'acm');
assert.equal(compactMatchKey('P C P'), 'pcp');
assert.equal(compactMatchKey('P.C.P'), 'pcp');

assert.equal(
  expandRhAbbreviations('AUX PRODUCAO JR'),
  'auxiliar producao junior',
);
assert.equal(
  expandRhAbbreviations('OPERADOR MAQ. PLENO'),
  'operador maquina pleno',
);
assert.equal(expandRhAbbreviations('PINTOR PLEN'), 'pintor pleno');

assert.ok(
  scoreStructureNameMatch('OPERADOR MAQ. PLENO', 'Operador De Máquina Pleno') >=
    90,
);
assert.ok(
  scoreStructureNameMatch(
    'AUX PRODUCAO JR',
    'Auxiliar De Produção Júnior',
  ) >= 85,
);
assert.equal(
  scoreStructureNameMatch('PINTOR PLEN', 'Pintor Júnior'),
  0,
  'senioridade divergente deve zerar',
);
assert.ok(
  scoreStructureNameMatch('PINTOR PLEN', 'Pintor Pleno') >= 90,
);

const sectors = [
  { name: 'ACM' },
  { name: 'COMPOSTOS PLÁSTICOS' },
  { name: 'COMPRAS' },
  { name: 'P.C.P' },
  { name: 'SERRALHEIRA' },
  { name: 'ENGARIA PRODUTO / DESENVOLVIMENTO' },
  { name: 'ENG. PROD. / METODOS E PROCESSOS' },
  { name: 'ESTOQUE DE PRODUTO ACABADO' },
  { name: 'MANUTENÇÃO' },
  { name: 'ORÇAMENTO' },
  { name: 'DEPARTAMENTO PESSOAL' },
];

assert.equal(
  findBestSectorMatch('A C M', sectors, (s) => s.name)?.item.name,
  'ACM',
);
assert.equal(
  findBestSectorMatch('P C P', sectors, (s) => s.name)?.item.name,
  'P.C.P',
);
assert.equal(
  findBestSectorMatch('ADMINISTRACAO DE COMPRAS', sectors, (s) => s.name)?.item
    .name,
  'COMPRAS',
);
assert.equal(
  findBestSectorMatch('SERRALHERIA', sectors, (s) => s.name)?.item.name,
  'SERRALHEIRA',
);
assert.equal(
  findBestSectorMatch('ESTOQUE PRODUTO ACABADO', sectors, (s) => s.name)?.item
    .name,
  'ESTOQUE DE PRODUTO ACABADO',
);
assert.equal(
  findBestSectorMatch('ORCAMENTOS', sectors, (s) => s.name)?.item.name,
  'ORÇAMENTO',
);
assert.equal(
  findBestSectorMatch('METODOS E PROCESSOS', sectors, (s) => s.name)?.item.name,
  'ENG. PROD. / METODOS E PROCESSOS',
);
assert.equal(
  findBestSectorMatch('ENG. PRODUTO / DESENVOLVIMENTO', sectors, (s) => s.name)
    ?.item.name,
  'ENGARIA PRODUTO / DESENVOLVIMENTO',
);
assert.equal(
  findBestSectorMatch('RECURSOS HUMANOS', sectors, (s) => s.name)?.item.name,
  'DEPARTAMENTO PESSOAL',
);
assert.equal(
  findBestSectorMatch('MANUTENCAO PREDIAL', sectors, (s) => s.name)?.item.name,
  'MANUTENÇÃO',
);

const jobs = [
  { name: 'Operador De Máquina Pleno' },
  { name: 'Operador De Máquina Júnior' },
  { name: 'Auxiliar De Produção Júnior' },
  { name: 'Auxiliar De Produção Pleno' },
  { name: 'Pintor Pleno' },
  { name: 'Pintor Júnior' },
  { name: 'Consultor Interno De Vendas' },
  { name: 'Executivo De Relacionamento' },
  { name: 'Auxiliar De Instalação Júnior' },
];

assert.equal(
  findBestJobMatch('OPERADOR MAQ. PLENO', jobs, (j) => j.name)?.item.name,
  'Operador De Máquina Pleno',
);
assert.equal(
  findBestJobMatch('OPERADOR MAQ. JR', jobs, (j) => j.name)?.item.name,
  'Operador De Máquina Júnior',
);
assert.equal(
  findBestJobMatch('AUX PRODUCAO JR', jobs, (j) => j.name)?.item.name,
  'Auxiliar De Produção Júnior',
);
assert.equal(
  findBestJobMatch('PINTOR PLEN', jobs, (j) => j.name)?.item.name,
  'Pintor Pleno',
);
assert.equal(
  findBestJobMatch('CONSULT INT VENDAS', jobs, (j) => j.name)?.item.name,
  'Consultor Interno De Vendas',
);
assert.equal(
  findBestJobMatch('EXEC RELACIONAMENTO', jobs, (j) => j.name)?.item.name,
  'Executivo De Relacionamento',
);
assert.equal(
  findBestJobMatch('AUX INSTALACAO JR', jobs, (j) => j.name)?.item.name,
  'Auxiliar De Instalação Júnior',
);

assert.equal(
  findBestJobMatch('AUX COMPRAS JUNIOR', [{ name: 'Comprador Júnior' }], (j) => j.name)
    ?.item.name,
  'Comprador Júnior',
);
assert.equal(
  findBestJobMatch('ANAL DE COMPRAS PLEN', [{ name: 'Comprador Júnior' }], (j) => j.name)
    ?.item.name,
  'Comprador Júnior',
);
assert.equal(
  findBestJobMatch('PINTOR PLEN', [{ name: 'Pintor Júnior' }], (j) => j.name)?.item
    .name,
  'Pintor Júnior',
);

console.log('worker-structure-match.selftest: ok');
