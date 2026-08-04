'use client';

import Link from 'next/link';

type Props = {
  moduleLabel: string;
};

/**
 * Aviso em telas de catalogo da Consultoria:
 * estoque operacional vive apenas no Painel do Cliente.
 */
export function ClientScopeNotice({ moduleLabel }: Props) {
  return (
    <div className="notice notice--info" role="status">
      <p>
        <strong>{moduleLabel}</strong> nesta tela e o catalogo da Consultoria
        (tenant). O estoque operacional (entrada, saldo e baixa) fica no{' '}
        <Link href="/portal/login">Painel do Cliente</Link>.
      </p>
    </div>
  );
}
