import type { Metadata } from 'next';
import { APP_NAME } from '@gestao-epi/shared';
import { ProdutoLanding } from '../../components/marketing/ProdutoLanding';

export const metadata: Metadata = {
  title: `Painel do Cliente — ${APP_NAME}`,
  description:
    'Gestao de EPI no dia a dia da empresa: entrega com biometria, estoque com CA certo, validade e relatorios — sem planilha.',
  openGraph: {
    title: `${APP_NAME} · Painel do Cliente`,
    description:
      'EPI sob controle no chao de fabrica. Entrega, estoque e conformidade NR-06 no ritmo da operacao.',
    images: [{ url: '/marketing/painel.png' }],
  },
};

export default function ProdutoPage() {
  return <ProdutoLanding />;
}
