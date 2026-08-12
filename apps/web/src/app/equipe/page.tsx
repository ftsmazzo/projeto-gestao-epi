import { redirect } from 'next/navigation';

/** Equipe da consultoria vive em Configuracoes. */
export default function EquipeRedirectPage() {
  redirect('/configuracoes?aba=equipe');
}
