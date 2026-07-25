/**
 * Self-test: agrupamento de necessidades por epiNeedId (07.2.1).
 * Uso: npx --yes tsx src/portal/portal-epi-coverage.selftest.ts
 */
import {
  groupCoverageRequirementsByNeed,
  resolveRestrictiveReplacementDays,
} from './portal-epi-coverage.utils';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function run() {
  const grouped = groupCoverageRequirementsByNeed([
    {
      id: 'r1',
      epiNeedId: 'need-oculos',
      needName: 'Oculos de Seguranca',
      isRequired: true,
      quantity: 1,
      replacementIntervalDays: 365,
      riskId: 'risk-ruido',
      riskName: 'Ruido',
    },
    {
      id: 'r2',
      epiNeedId: 'need-oculos',
      needName: 'Oculos de Seguranca',
      isRequired: false,
      quantity: 2,
      replacementIntervalDays: 180,
      riskId: 'risk-calor',
      riskName: 'Calor',
    },
    {
      id: 'r3',
      epiNeedId: 'need-oculos',
      needName: 'Oculos de Seguranca',
      isRequired: true,
      quantity: 1,
      replacementIntervalDays: 365,
      riskId: 'risk-postura',
      riskName: 'Posturas inadequadas',
    },
    {
      id: 'r4',
      epiNeedId: 'need-botina',
      needName: 'Botina de Seguranca',
      isRequired: true,
      quantity: 1,
      replacementIntervalDays: 365,
      riskId: 'risk-ruido',
      riskName: 'Ruido',
    },
    {
      id: 'r5',
      epiNeedId: 'need-botina',
      needName: 'Botina de Seguranca',
      isRequired: true,
      quantity: 1,
      replacementIntervalDays: 365,
      riskId: 'risk-calor',
      riskName: 'Calor',
    },
  ]);

  assert(grouped.length === 2, `esperado 2 necessidades, veio ${grouped.length}`);

  const oculos = grouped.find((g) => g.epiNeedId === 'need-oculos');
  assert(Boolean(oculos), 'oculos deve existir');
  assert(oculos!.risks.length === 3, 'oculos deve ter 3 riscos agrupados');
  assert(
    oculos!.risks.map((r) => r.name).sort().join('|') ===
      ['Calor', 'Posturas inadequadas', 'Ruido'].sort().join('|'),
    'riscos de oculos incorretos',
  );
  assert(oculos!.quantity === 2, 'quantidade deve ser a maior (2)');
  assert(
    oculos!.replacementIntervalDays === 180,
    'periodicidade deve ser a menor (180)',
  );
  assert(oculos!.isRequired === true, 'obrigatorio se qualquer requisito for');
  assert(oculos!.warnings.length === 1, 'deve haver warning de criterio restritivo');
  assert(oculos!.requirementIds.length === 3, 'deve listar 3 requirementIds');

  const botina = grouped.find((g) => g.epiNeedId === 'need-botina');
  assert(Boolean(botina), 'botina deve existir');
  assert(botina!.risks.length === 2, 'botina deve ter 2 riscos');
  assert(botina!.warnings.length === 0, 'botina sem conflito nao deve ter warning');

  assert(
    resolveRestrictiveReplacementDays([365, 180, null]) === 180,
    'resolveRestrictiveReplacementDays deve pegar o minimo',
  );

  // 40 requisitos (10 needs x 4 risks) -> 10 agrupados
  const many = groupCoverageRequirementsByNeed(
    Array.from({ length: 40 }, (_, i) => ({
      id: `req-${i}`,
      epiNeedId: `need-${Math.floor(i / 4)}`,
      needName: `Need ${Math.floor(i / 4)}`,
      isRequired: true,
      quantity: 1,
      replacementIntervalDays: 365,
      riskId: `risk-${i % 4}`,
      riskName: `Risk ${i % 4}`,
    })),
  );
  assert(many.length === 10, `40 requisitos devem virar 10 needs, veio ${many.length}`);
  assert(
    many.every((g) => g.risks.length === 4),
    'cada need deve ter 4 riscos',
  );

  console.log('portal-epi-coverage.selftest: OK');
}

run();
