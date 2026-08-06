import type { Metadata } from 'next';
import { APP_NAME } from '@gestao-epi/shared';
import { ProdutoLanding } from '../../components/marketing/ProdutoLanding';

export const metadata: Metadata = {
  title: `Painel do Cliente — ${APP_NAME}`,
  description:
    'Pare de gerir EPI na planilha. Entrega facial, estoque com CA certo e alertas NR-06 no Painel do Cliente ProntEPI.',
  openGraph: {
    title: `${APP_NAME} · Painel do Cliente`,
    description:
      'Entrega facial, estoque e conformidade NR-06 no ritmo do chao de fabrica.',
  },
};

export default function ProdutoPage() {
  return <ProdutoLanding />;
}
