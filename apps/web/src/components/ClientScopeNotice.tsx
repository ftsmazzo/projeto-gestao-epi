'use client';

import Link from 'next/link';

type Props = {
  moduleLabel: string;
};

/**
 * Aviso nas rotas globais de EPI/estoque/necessidades:
 * a operacao diaria deve partir do painel do cliente.
 */
export function ClientScopeNotice({ moduleLabel }: Props) {
  return (
    <div className="notice notice--info" role="status">
      <p>
        <strong>{moduleLabel}</strong> nesta tela e o estoque/catalogo da
        Consultoria (tenant). O estoque operacional da empresa cliente fica no{' '}
        <Link href="/portal">Painel do Cliente</Link> (login em /portal/login).
      </p>
      <p className="table-sub">
        Locais com empresa vinculada nao aparecem aqui — so almoxarifados da
        Consultoria.
      </p>
    </div>
  );
}
