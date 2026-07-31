import type { RunDailyAlertsResult } from '@gestao-epi/shared';
import { apiFetch } from './auth';

export function runDailyClientAlerts(servedClientId?: string) {
  return apiFetch<RunDailyAlertsResult>('/communications/alerts/daily/run', {
    method: 'POST',
    body: JSON.stringify(
      servedClientId ? { servedClientId } : {},
    ),
  });
}

export function dailyAlertsResultMessage(result: RunDailyAlertsResult): string {
  switch (result.skippedReason) {
    case 'communications_disabled':
      return 'Comunicacoes desligadas (COMMUNICATIONS_ENABLED).';
    case 'alerts_disabled':
      return 'Alertas diarios pausados (COMMUNICATIONS_ALERTS_ENABLED=false).';
    case 'no_alerts':
      return 'Nada a alertar neste cliente (sem trocas, CA ou biometria pendente).';
    case 'no_recipients':
      return 'Ha alertas, mas nao ha e-mail/WhatsApp no contato institucional nem nos gestores.';
    case 'already_sent_today':
      return 'Alerta deste cliente ja foi enviado hoje (dedupe).';
    case 'client_not_found':
      return 'Cliente nao encontrado.';
    default:
      break;
  }
  if (result.messages > 0) {
    return `Alerta enfileirado: ${result.messages} mensagem(ns) para ${result.clients} cliente(s).`;
  }
  return 'Nenhuma mensagem enfileirada.';
}
