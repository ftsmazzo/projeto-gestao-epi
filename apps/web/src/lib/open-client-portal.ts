import { clearClientAccessToken } from './client-auth';

/** Login do portal sem sessao anterior (consulta da consultoria). */
export const CLIENT_PORTAL_LOGIN_FRESH = '/portal/login?sair=1';

export function openClientPortalFresh() {
  if (typeof window === 'undefined') return;
  clearClientAccessToken();
  window.open(CLIENT_PORTAL_LOGIN_FRESH, '_blank', 'noopener,noreferrer');
}
