import assert from 'assert';
import { EpiUsefulLifeUnit } from '@prisma/client';
import {
  calendarDaysRemaining,
  computeNextReplacementAt,
  formatRemainingDays,
  usefulLifeToBaseDays,
} from './replacement-schedule.utils';
import { resolveUsefulLife } from '../epi-needs/epi-useful-life.defaults';

function run() {
  assert.strictEqual(usefulLifeToBaseDays(180, EpiUsefulLifeUnit.DIAS), 180);
  assert.strictEqual(usefulLifeToBaseDays(6, EpiUsefulLifeUnit.MESES), 180);
  assert.strictEqual(usefulLifeToBaseDays(1, EpiUsefulLifeUnit.ANOS), 365);

  const delivered = new Date('2026-01-01T12:00:00.000Z');
  const next = computeNextReplacementAt({
    deliveredAt: delivered,
    usefulLifeValue: 180,
    usefulLifeUnit: EpiUsefulLifeUnit.DIAS,
    usageDaysPerWeek: 1,
  });
  assert.ok(next);
  assert.strictEqual(next.toISOString().slice(0, 10), '2026-06-30');

  const generated = new Date('2026-01-31T12:00:00.000Z');
  assert.strictEqual(calendarDaysRemaining(next, generated), 150);
  assert.strictEqual(formatRemainingDays(150), '150 dia(s) restante(s)');
  assert.strictEqual(formatRemainingDays(-3), 'Vencido ha 3 dia(s)');

  const boot = resolveUsefulLife({ name: 'Botina de Seguranca' });
  assert.ok(boot);
  assert.strictEqual(boot.value, 6);
  assert.strictEqual(boot.unit, EpiUsefulLifeUnit.MESES);

  const plug = resolveUsefulLife({ name: 'Protetor Auricular Plug' });
  assert.strictEqual(plug?.value, 1);
  assert.strictEqual(plug?.unit, EpiUsefulLifeUnit.MESES);

  const leaked = resolveUsefulLife({
    name: 'Botina de Seguranca',
    value: 1,
    unit: 'DIAS',
  });
  assert.strictEqual(leaked?.value, 6);
  assert.strictEqual(leaked?.unit, EpiUsefulLifeUnit.MESES);

  const helmet = resolveUsefulLife({ name: 'Capacete de Seguranca' });
  assert.strictEqual(helmet?.value, 5);
  assert.strictEqual(helmet?.unit, EpiUsefulLifeUnit.ANOS);

  const pvc = resolveUsefulLife({ name: 'Avental de PVC' });
  assert.strictEqual(pvc?.value, 30);
  assert.strictEqual(pvc?.unit, EpiUsefulLifeUnit.DIAS);

  const raspaGlove = resolveUsefulLife({ name: 'Luva de Raspa' });
  assert.strictEqual(raspaGlove?.value, 15);

  console.log('replacement-schedule.selftest ok');
}

run();
