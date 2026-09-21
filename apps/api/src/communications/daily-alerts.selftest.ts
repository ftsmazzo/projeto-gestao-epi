import assert from 'node:assert/strict';
import { buildDailyAlertMessage } from '@gestao-epi/shared';
import {
  buildDailyClientAlertsEmail,
  buildDailyClientAlertsWhatsapp,
} from './communication.templates';

const now = new Date('2026-09-21T15:00:00.000Z');

const built = buildDailyAlertMessage({
  recipientName: 'Maria Souza',
  clientName: 'Acme Industrial',
  portalUrl: 'https://portal.exemplo/painel',
  now,
  limitPerSection: 2,
  replacements: [
    {
      workerName: 'João Silva',
      epiName: 'Capacete de segurança',
      caNumber: '12345',
      dueAt: new Date('2026-09-18T12:00:00.000Z'),
    },
    {
      workerName: 'Ana Costa',
      epiName: 'Luva nitrílica',
      dueAt: new Date('2026-09-21T12:00:00.000Z'),
    },
    {
      workerName: 'Pedro Lima',
      epiName: 'Protetor auricular',
      dueAt: new Date('2026-09-30T12:00:00.000Z'),
    },
  ],
  caAlerts: [
    {
      epiName: 'Óculos de segurança',
      caNumber: '99887',
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      kind: 'expired',
    },
    {
      epiName: 'Protetor auricular',
      caNumber: null,
      expiresAt: null,
      kind: 'missing',
    },
  ],
  biometricNames: ['Pedro Lima'],
});

assert.match(built.subject, /Alertas de Acme Industrial em 21\/09\/2026/);
assert.match(built.text, /Olá, Maria Souza/);
assert.match(
  built.text,
  /O Capacete de segurança \(CA 12345\) do funcionário João Silva venceu em 18\/09\/2026/,
);
assert.match(built.text, /Faça a troca hoje/);
assert.match(
  built.text,
  /Luva nitrílica do funcionário Ana Costa vence hoje, 21\/09\/2026/,
);
assert.match(built.text, /Mais 1 troca de EPI está no painel/);
assert.match(
  built.text,
  /O CA 99887 do EPI Óculos de segurança venceu em 01\/08\/2026/,
);
assert.match(built.text, /Suspenda novas entregas/);
assert.match(
  built.text,
  /O EPI Protetor auricular exige CA e ainda não tem número cadastrado/,
);
assert.match(
  built.text,
  /O funcionário Pedro Lima está ativo e ainda não tem biometria facial/,
);
assert.match(built.text, /https:\/\/portal\.exemplo\/painel/);
assert.equal(built.text.includes('—'), false);
assert.equal(built.text.includes('–'), false);
assert.equal(built.text.includes('•'), false);
assert.equal(built.text.includes('·'), false);
assert.equal(built.text.includes('*'), false);
assert.equal(built.text.includes(' - '), false);
assert.equal(built.text.includes('\\n'), false);

const soon = buildDailyClientAlertsWhatsapp({
  recipientName: 'Maria Souza',
  clientName: 'Acme Industrial',
  portalUrl: 'https://portal.exemplo/painel',
  now,
  replacements: [
    {
      workerName: 'João Silva',
      epiName: 'Capacete de segurança',
      dueAt: new Date('2026-09-24T12:00:00.000Z'),
    },
  ],
  caAlerts: [
    {
      epiName: 'Capacete de segurança',
      caNumber: '12345',
      expiresAt: new Date('2026-10-02T00:00:00.000Z'),
      kind: 'soon',
    },
  ],
  biometricNames: [],
});

assert.match(
  soon,
  /O Capacete de segurança do funcionário João Silva vence em 24\/09\/2026/,
);
assert.match(soon, /Entregue com prioridade antes dessa data/);
assert.match(
  soon,
  /O CA 12345 do EPI Capacete de segurança vence em 02\/10\/2026/,
);
assert.match(soon, /Renove o certificado ou substitua o item/);
assert.equal(soon.includes('Biometria facial'), false);
assert.equal(soon.includes('*'), false);

const email = buildDailyClientAlertsEmail({
  recipientName: 'Maria Souza',
  clientName: 'Acme Industrial',
  portalUrl: 'https://portal.exemplo/painel',
  now,
  replacements: [
    {
      workerName: 'João Silva',
      epiName: 'Capacete de segurança',
      dueAt: new Date('2026-09-24T12:00:00.000Z'),
    },
  ],
  caAlerts: [],
  biometricNames: [],
});
assert.match(email.subject, /Acme Industrial/);
assert.match(email.text, /João Silva/);
assert.equal(email.text.includes('*'), false);

console.log('daily-alerts.selftest: ok');
