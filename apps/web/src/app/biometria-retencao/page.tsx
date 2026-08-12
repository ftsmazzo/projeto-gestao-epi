import { redirect } from 'next/navigation';

/** Retencao biometrica vive em Configuracoes. */
export default function BiometriaRedirectPage() {
  redirect('/configuracoes?aba=biometria');
}
