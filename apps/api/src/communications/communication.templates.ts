export const COMM_TEMPLATE_CLIENT_ACCESS_INVITE = 'client_access_invite';
export const COMM_TEMPLATE_DAILY_ALERTS = 'daily_client_alerts';
export const COMM_TEMPLATE_FACIAL_ENROLLMENT_INVITE = 'facial_enrollment_invite';

export type ClientAccessInviteInput = {
  organizationId: string;
  organizationName: string;
  recipientName: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  temporaryPassword: string;
  accessUrl: string;
  membershipId: string;
  replyToEmail?: string | null;
};

export type DailyClientAlertsInput = {
  organizationName: string;
  clientName: string;
  recipientName: string;
  portalUrl: string;
  replacementTotal: number;
  replacementUrgent: number;
  caTotal: number;
  biometricsMissing: number;
  warnDays: number;
  criticalDays: number;
};

export function buildClientAccessInviteEmail(input: ClientAccessInviteInput) {
  const subject = `Acesso ao portal — ${input.organizationName}`;
  const text = [
    `Ola, ${input.recipientName}.`,
    '',
    `A consultoria ${input.organizationName} liberou seu acesso ao portal do cliente.`,
    '',
    `Link: ${input.accessUrl}`,
    `E-mail: ${input.recipientEmail ?? '—'}`,
    `Senha temporaria: ${input.temporaryPassword}`,
    '',
    'No primeiro acesso, voce devera trocar a senha.',
    'Use apenas o portal do cliente — nao o login da Consultoria.',
  ].join('\n');

  return { subject, text };
}

export function buildClientAccessInviteWhatsapp(
  input: ClientAccessInviteInput,
) {
  return [
    `*Acesso ao portal* — ${input.organizationName}`,
    `Ola, ${input.recipientName}.`,
    `Link: ${input.accessUrl}`,
    `E-mail: ${input.recipientEmail ?? '—'}`,
    `Senha temporaria: ${input.temporaryPassword}`,
    'Troque a senha no primeiro acesso.',
  ].join('\n');
}

export function buildDailyClientAlertsEmail(input: DailyClientAlertsInput) {
  const subject = `Alertas do dia — ${input.clientName}`;
  const lines = [
    `Ola, ${input.recipientName}.`,
    '',
    `Resumo de atencao para ${input.clientName} (${input.organizationName}):`,
    '',
  ];
  if (input.replacementTotal > 0) {
    lines.push(
      `• Vida util / trocas: ${input.replacementTotal} item(ns) (ate ${input.warnDays}d; ${input.replacementUrgent} urgente(s) em ate ${input.criticalDays}d ou vencido)`,
    );
  }
  if (input.caTotal > 0) {
    lines.push(`• Validade de CA: ${input.caTotal} alerta(s)`);
  }
  if (input.biometricsMissing > 0) {
    lines.push(
      `• Biometria pendente: ${input.biometricsMissing} trabalhador(es)`,
    );
  }
  lines.push('', `Painel: ${input.portalUrl}`, '');
  lines.push('Acesse o portal do cliente para agir.');
  return { subject, text: lines.join('\n') };
}

export function buildDailyClientAlertsWhatsapp(input: DailyClientAlertsInput) {
  const lines = [
    `*Alertas — ${input.clientName}*`,
    `Ola, ${input.recipientName}.`,
  ];
  if (input.replacementTotal > 0) {
    lines.push(
      `Trocas: ${input.replacementTotal} (urgentes: ${input.replacementUrgent})`,
    );
  }
  if (input.caTotal > 0) {
    lines.push(`CA em alerta: ${input.caTotal}`);
  }
  if (input.biometricsMissing > 0) {
    lines.push(`Sem biometria: ${input.biometricsMissing}`);
  }
  lines.push(`Painel: ${input.portalUrl}`);
  return lines.join('\n');
}

export type FacialEnrollmentInviteInput = {
  workerName: string;
  enrollmentUrl: string;
  expiresAtIso: string;
};

export function buildFacialEnrollmentInviteWhatsapp(
  input: FacialEnrollmentInviteInput,
) {
  const firstName =
    input.workerName.trim().split(/\s+/)[0] || input.workerName;
  const expiresLabel = new Date(input.expiresAtIso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return [
    `Ola, ${firstName}.`,
    'Cadastre sua biometria facial para receber EPI com seguranca.',
    `Link (valido 24h, ate ${expiresLabel}):`,
    input.enrollmentUrl,
    'Voce precisara dos 4 ultimos digitos do CPF.',
  ].join('\n');
}
