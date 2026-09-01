import assert from 'node:assert/strict';
import {
  canonicalizeEpiNeedLabel,
  collapseExtractedEpiLabels,
  epiNeedsAreSame,
  isGluedEpiNeedName,
  isJunkEpiNeedName,
  needNameMatchesEquipment,
  pickNeedsToLinkForEquipment,
  splitGluedEpiPhrases,
} from './epi-need-canonical';

const USER_CATALOG = [
  'Avental de PVC',
  'Avental de Raspa',
  'Avental de Raspa de Couro',
  'Botina De PVC',
  'Botina De Segurança Com Bico De Polipropileno',
  'Capacete De Segurança Com Jugular',
  'Capacete de Segurança com Jugular Cinto de Segurança Modelo Paraquedista Talabarte Duplo (Y) com ABS',
  'Capacete de Segurança com Jugular (Subir Carroceria)',
  'Cinto de Segurança Modelo Paraquedista',
  'Cinto de Segurança Modelo Paraquedista Talabarte Duplo (Y) com ABS',
  'Creme De Proteção Das Mãos 3x1',
  'Luva De Nitrílica',
  'Luva de Raspa de Couro',
  'Luva De Vaqueta',
  'Luva Nitrílica',
  'Luva Pigmentada Anti Corte',
  'Luva Pigmentada Com Banho Nitrílico',
  'Luva Vaqueta',
  'Macacão Tyvec',
  'Mangote de Brim',
  'Mangote de Raspa',
  'Óculos de Segurança de Policarbonato',
  '(Poeira e Fumos Metálicos),',
  'Protetor Auricular Tipo Plu',
  'Protetor Auricular Tipo Plug',
  'Protetor Facial de Acrílico',
  'Realizar Manutenção de Rotina no Caminhão',
  'Realizar Periodicamente Exame de Audiometria',
  'Respirador Descartável PFF2 Para Fumos Metálicos e Poeiras',
  'Respirador Descartável PFF2 Válvula (Poeira)',
  'Respirador PFF2 Valvulado',
  'Respirador PFF2 Valvulado (fumos metálicos)',
  'Respirador PFF2 Valvulado (Poeira e Fumos Metálicos),',
  'Respirador Semifacial com Cartuchos V.O',
  'Respirador Semifacial P2 com Cartuchos V.O',
  'Respirador Semi Facial P2 Para Vapores Orgânicos',
  'Respirador Semifacial P2 – Vapores Orgânicos',
  'Talabarte Duplo (Y) com ABS',
  'Touca Tipo Árabe',
  'Luva de Segurança Nitrilica',
  'Luva de Segurança Vaqueta',
  'Óculos de Segurança com Lente Escura Tonalidade',
  'Definição de Tempo de Espera Seguro Antes de Tocar nas Peças ou na Área de Corte',
  'Respirador Valvulado PFF2 para Fumos Metálicos e Poeiras',
  'Protetor Auricular Plug',
];

assert.equal(isJunkEpiNeedName('(Poeira e Fumos Metálicos),'), true);
assert.equal(isJunkEpiNeedName('Moderado'), true);
assert.equal(isJunkEpiNeedName('Planejamento Das Atividades'), true);
assert.equal(isJunkEpiNeedName('Usar cinto de segurança'), true);
assert.equal(isJunkEpiNeedName('Respeitar velocidade'), true);
assert.equal(isJunkEpiNeedName('Medidas Administrativas'), true);
assert.equal(
  isJunkEpiNeedName('Cinto de Segurança Modelo Paraquedista'),
  false,
);
assert.equal(isJunkEpiNeedName('Luva Nitrílica'), false);
assert.equal(
  isJunkEpiNeedName('Realizar Manutenção de Rotina no Caminhão'),
  true,
);
assert.equal(
  isJunkEpiNeedName('Realizar Periodicamente Exame de Audiometria'),
  true,
);

assert.equal(
  epiNeedsAreSame('Luva De Nitrílica', 'Luva Nitrílica'),
  true,
);
assert.equal(epiNeedsAreSame('Luva De Vaqueta', 'Luva Vaqueta'), true);
assert.equal(
  epiNeedsAreSame('Avental de Raspa', 'Avental de Raspa de Couro'),
  true,
);
assert.equal(
  isJunkEpiNeedName(
    'Definição de Tempo de Espera Seguro Antes de Tocar nas Peças ou na Área de Corte',
  ),
  true,
);
assert.equal(
  epiNeedsAreSame('Luva de Segurança Nitrilica', 'Luva Nitrílica'),
  true,
);
assert.equal(
  epiNeedsAreSame(
    'Óculos de Segurança com Lente Escura Tonalidade',
    'Óculos de Segurança de Policarbonato',
  ),
  true,
);
assert.equal(
  epiNeedsAreSame('Avental de PVC', 'Avental de Raspa'),
  false,
);
assert.equal(
  epiNeedsAreSame(
    'Botina De PVC',
    'Botina De Segurança Com Bico De Polipropileno',
  ),
  false,
);
assert.equal(
  epiNeedsAreSame(
    'Protetor Auricular Tipo Plu',
    'Protetor Auricular Tipo Plug',
  ),
  true,
);

const glued = splitGluedEpiPhrases(
  'Capacete de Segurança com Jugular Cinto de Segurança Modelo Paraquedista Talabarte Duplo (Y) com ABS',
);
assert.ok(
  glued.some((part) => /capacete/i.test(part)),
  `split capacete: ${glued.join(' | ')}`,
);
assert.ok(
  glued.some((part) => /cinto/i.test(part)),
  `split cinto: ${glued.join(' | ')}`,
);
assert.equal(
  isGluedEpiNeedName(
    'Capacete de Segurança com Jugular Cinto de Segurança Modelo Paraquedista Talabarte Duplo (Y) com ABS',
  ),
  true,
);
assert.equal(isGluedEpiNeedName('Luva Nitrílica'), false);

assert.equal(
  canonicalizeEpiNeedLabel('Luva Nitrílica'),
  'Luva Nitrilica',
);
assert.equal(
  canonicalizeEpiNeedLabel('Respirador PFF2 Valvulado (fumos metálicos)'),
  'Respirador PFF2',
);
assert.equal(
  canonicalizeEpiNeedLabel('Óculos de Segurança de Policarbonato'),
  'Oculos de Seguranca',
);

const collapsed = collapseExtractedEpiLabels(USER_CATALOG);
const nitrilica = collapsed.filter((name) => /nitril/i.test(name));
assert.equal(
  nitrilica.length,
  1,
  `nitrilica duplicada: ${nitrilica.join(' | ')}`,
);
const vaqueta = collapsed.filter((name) => /vaqueta/i.test(name));
assert.equal(vaqueta.length, 1, `vaqueta duplicada: ${vaqueta.join(' | ')}`);
const pff2 = collapsed.filter((name) => /pff2/i.test(name));
assert.equal(pff2.length, 1, `pff2 duplicado: ${pff2.join(' | ')}`);
const plugs = collapsed.filter((name) => /auricular/i.test(name));
assert.equal(plugs.length, 1, `plug duplicado: ${plugs.join(' | ')}`);
const aventalRaspa = collapsed.filter((name) => /avental.*raspa/i.test(name));
assert.equal(
  aventalRaspa.length,
  1,
  `avental raspa duplicado: ${aventalRaspa.join(' | ')}`,
);
assert.ok(
  collapsed.some((name) => /avental de pvc/i.test(name)),
  `faltou avental pvc: ${collapsed.join(' | ')}`,
);
assert.equal(
  collapsed.some((name) => /realizar/i.test(name)),
  false,
);
assert.equal(
  collapsed.some((name) => /poeira e fumos/i.test(name)),
  false,
);
const semi = collapsed.filter((name) => /semifacial|\bsemi\b/i.test(name));
assert.ok(semi.length <= 1, `semifacial duplicado: ${semi.join(' | ')}`);

assert.equal(
  needNameMatchesEquipment(
    'Capacete de Seguranca',
    'Capacete de Seguranca com jugular',
  ),
  true,
);
assert.equal(
  needNameMatchesEquipment('Respirador PFF2', 'Peca filtrante PFF2'),
  true,
);
assert.equal(
  needNameMatchesEquipment(
    'Capacete de Seguranca',
    'Respirador semifacial PFF2',
  ),
  false,
);

const pgrNeeds = [
  { id: '1', name: 'Luva De Nitrílica' },
  { id: '2', name: 'Capacete de Segurança com Jugular' },
  { id: '3', name: 'Realizar Manutenção de Rotina no Caminhão' },
];
assert.deepEqual(
  pickNeedsToLinkForEquipment(
    pgrNeeds,
    'Luva de seguranca nitrilica descartavel',
  ).map((need) => need.id),
  ['1'],
);
assert.deepEqual(
  pickNeedsToLinkForEquipment(
    pgrNeeds,
    'Capacete de seguranca com jugular ajustavel',
  ).map((need) => need.id),
  ['2'],
);
assert.deepEqual(
  pickNeedsToLinkForEquipment(pgrNeeds, 'Macacão impermeavel Tyvek').length,
  0,
);

console.log(`epi-need-canonical.selftest: ok (${collapsed.length} nomes)`);
console.log(collapsed.sort((a, b) => a.localeCompare(b, 'pt-BR')).join('\n'));
