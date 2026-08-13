export const COMM_TEMPLATE_CLIENT_ACCESS_INVITE = 'client_access_invite';
export const COMM_TEMPLATE_CONSULTORIA_ACCESS_INVITE =
  'consultoria_access_invite';
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

export type ConsultoriaAccessInviteInput = {
  organizationId: string;
  organizationName: string;
  recipientName: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  temporaryPassword: string;
  accessUrl: string;
  membershipId: string;
  roleLabel: string;
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
  const subject = `ProntEPI — acesso ao portal (${input.organizationName})`;
  const text = [
    `Ola, ${input.recipientName}.`,
    '',
    `A ProntEPI liberou seu acesso ao portal do cliente, pela consultoria ${input.organizationName}.`,
    '',
    `Link: ${input.accessUrl}`,
    `E-mail: ${input.recipientEmail ?? '—'}`,
    `Senha temporaria: ${input.temporaryPassword}`,
    '',
    'No primeiro acesso, troque a senha.',
    'Dúvidas: fale com a ProntEPI. Este canal atende consultorias e empresas clientes.',
  ].join('\n');

  return { subject, text };
}

export function buildClientAccessInviteWhatsapp(
  input: ClientAccessInviteInput,
) {
  return [
    `*ProntEPI* — acesso ao portal`,
    `Ola, ${input.recipientName}.`,
    `Consultoria: ${input.organizationName}`,
    `Link: ${input.accessUrl}`,
    `E-mail: ${input.recipientEmail ?? '—'}`,
    `Senha temporaria: ${input.temporaryPassword}`,
    'Troque a senha no primeiro acesso. Suporte: ProntEPI.',
  ].join('\n');
}

export function buildConsultoriaAccessInviteEmail(
  input: ConsultoriaAccessInviteInput,
) {
  const subject = `ProntEPI — acesso a gestao (${input.organizationName})`;
  const text = [
    `Ola, ${input.recipientName}.`,
    '',
    `A ProntEPI liberou o painel de gestao da consultoria ${input.organizationName}.`,
    `Papel: ${input.roleLabel}`,
    '',
    `Link: ${input.accessUrl}`,
    `E-mail: ${input.recipientEmail ?? '—'}`,
    `Senha temporaria: ${input.temporaryPassword}`,
    '',
    'No primeiro acesso, o sistema pede para trocar a senha.',
    'Depois, use Minha conta no canto superior do painel.',
    'Este e o login da consultoria — nao o portal do cliente.',
    'Dúvidas: fale com a ProntEPI. Este canal atende consultorias e empresas clientes.',
  ].join('\n');

  return { subject, text };
}

export function buildConsultoriaAccessInviteWhatsapp(
  input: ConsultoriaAccessInviteInput,
) {
  return [
    `*ProntEPI* — acesso a gestao`,
    `Ola, ${input.recipientName}.`,
    `Consultoria: ${input.organizationName}`,
    `Papel: ${input.roleLabel}`,
    `Link: ${input.accessUrl}`,
    `E-mail: ${input.recipientEmail ?? '—'}`,
    `Senha temporaria: ${input.temporaryPassword}`,
    'No primeiro acesso, troque a senha. Depois: Minha conta no painel.',
    'Login da consultoria (nao o portal do cliente). Suporte: ProntEPI.',
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
  lines.push('Acesse o portal do cliente para agir. Suporte: ProntEPI.');
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
  lines.push('Suporte: ProntEPI.');
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

export const COMM_TEMPLATE_SST_DOCUMENT_INVITE = 'sst_document_invite';
export const COMM_TEMPLATE_SST_DOCUMENT_SIGNED = 'sst_document_signed';

export type SstDocumentInviteInput = {
  workerName: string;
  documentTitle: string;
  signUrl: string;
  expiresAtIso: string;
};

export function buildSstDocumentInviteWhatsapp(input: SstDocumentInviteInput) {
  const firstName =
    input.workerName.trim().split(/\s+/)[0] || input.workerName;
  const expiresLabel = new Date(input.expiresAtIso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return [
    `Ola, ${firstName}.`,
    `Confirme a ciencia do documento: ${input.documentTitle}.`,
    `Link (valido 24h, ate ${expiresLabel}):`,
    input.signUrl,
    'Voce precisara dos 4 ultimos digitos do CPF e da camera.',
  ].join('\n');
}

export function buildSstDocumentSignedWhatsapp(input: {
  workerName?: string;
  documentTitle: string;
}) {
  const first = input.workerName?.trim().split(/\s+/)[0];
  return [
    first ? `Ola, ${first}.` : 'Ola.',
    `Sua ciencia no documento "${input.documentTitle}" foi registrada.`,
    'Guarde este comprovante. O RH da empresa tambem recebe o arquivo no ProntEPI.',
  ].join('\n');
}
