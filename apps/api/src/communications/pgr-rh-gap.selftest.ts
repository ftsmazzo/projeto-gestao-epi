import assert from 'node:assert/strict';
import { buildPgrRhGapAlertWhatsapp } from './communication.templates';

const text = buildPgrRhGapAlertWhatsapp({
  consultantName: 'Luciano',
  clientName: 'Maestralle',
  jobsWithoutEpi: 4,
  workersWithoutEpi: 12,
  sampleLines: [
    'ARQUITETURA / ANALISTA ARQUIT JR (2 vida(s))',
    'SUPORTE OPERACIONAL / JOVEM APRENDIZ ADM (1 vida(s))',
  ],
});

assert.match(text, /Luciano/);
assert.match(text, /Maestralle/);
assert.match(text, /4 cargo/);
assert.match(text, /12 trabalhador/);
assert.match(text, /ARQUITETURA/);
assert.match(text, /PGR atualizado/);
assert.ok(!text.includes('undefined'));

console.log('pgr-rh-gap.selftest: ok');
