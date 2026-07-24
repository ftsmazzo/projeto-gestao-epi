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
        <strong>{moduleLabel}</strong> ainda e catalogo/operacao do tenant
        (Consultoria). Para o movimento diario da empresa, abra um cliente em{' '}
        <Link href="/clientes">Clientes atendidos</Link> e use o painel
        operacional.
      </p>
      <p className="table-sub">
        Selecione um cliente para operar este modulo no contexto da empresa.
      </p>
    </div>
  );
}
