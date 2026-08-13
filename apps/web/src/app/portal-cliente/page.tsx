import { redirect } from 'next/navigation';

/** Atalho da consultoria: sempre a tela de login, sem sessao anterior. */
export default function PortalClienteRedirectPage() {
  redirect('/portal/login?sair=1');
}
