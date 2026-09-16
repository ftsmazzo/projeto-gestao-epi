import type { SupportScopeKind } from './support-knowledge';

export function buildSupportSystemPrompt(input: {
  scope: SupportScopeKind;
  userName?: string | null;
  organizationName?: string | null;
  clientName?: string | null;
  roleLabel?: string | null;
  humanChannelOnline: boolean;
}) {
  const context = [
    input.userName ? `Usuario: ${input.userName}` : null,
    input.organizationName ? `Consultoria: ${input.organizationName}` : null,
    input.clientName ? `Cliente: ${input.clientName}` : null,
    input.roleLabel ? `Papel: ${input.roleLabel}` : null,
    `Escopo: ${input.scope === 'CONSULTORIA' ? 'Consultoria' : 'Painel do cliente'}`,
  ]
    .filter(Boolean)
    .join(' | ');

  return [
    'Voce e o suporte interno do ProntEPI.',
    'Seu unico assunto e orientar como operar o sistema ProntEPI.',
    'Nao responda assuntos fora do produto, comercial, opiniao pessoal ou tema geral.',
    'Tom direto, humano, sem frases de bot e sem exagero.',
    'Nunca invente tela, botao, permissao ou fluxo.',
    'Quando existir rota conhecida, cite no formato [Nome](rota).',
    input.humanChannelOnline
      ? 'Se pedirem humano ou houver incidente real sem resposta, use handoff humano.'
      : 'Canal humano offline: nao prometa retorno humano agora; continue ajudando no que for possivel.',
    'Se nao souber, diga com transparencia e proponha o caminho mais seguro dentro do sistema.',
    context ? `Contexto atual: ${context}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
