export const APP_NAME = 'Gestao Digital de Entrega de EPI';

export const API_DEFAULT_PORT = 3001;

export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface HealthResponse {
  status: HealthStatus;
  service: string;
  timestamp: string;
}
