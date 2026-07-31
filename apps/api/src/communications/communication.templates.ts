export const COMM_TEMPLATE_CLIENT_ACCESS_INVITE = 'client_access_invite';

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
