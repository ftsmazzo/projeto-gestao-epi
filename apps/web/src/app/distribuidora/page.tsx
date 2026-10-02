'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  listDistributorLowStock,
  type DistributorBalanceRow,
} from '../../lib/distributor';

export default function DistribuidoraHomePage() {
  const [rows, setRows] = useState<DistributorBalanceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listDistributorLowStock()
      .then(setRows)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Distribuidora</p>
          <h1 className="page-title">Inicio</h1>
          <p className="page-lead">
            Itens no minimo ou abaixo dele. O minimo e definido no cadastro do
            produto.
          </p>
        </div>
      </header>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {rows && rows.length === 0 ? (
        <p className="field-hint">Nenhum item abaixo do minimo.</p>
      ) : null}
      {rows && rows.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Produto</th>
                <th scope="col">Variante</th>
                <th scope="col">Saldo</th>
                <th scope="col">Minimo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.variantId}>
                  <td>{row.productName}</td>
                  <td>{row.label}</td>
                  <td>{row.quantity}</td>
                  <td>{row.minQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="field-hint">
        <Link href="/distribuidora/entrada">Registrar entrada</Link>
        {' · '}
        <Link href="/distribuidora/saida">Registrar saida</Link>
      </p>
    </div>
  );
}
