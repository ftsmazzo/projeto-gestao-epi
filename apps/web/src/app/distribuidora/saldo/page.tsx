'use client';

import { useEffect, useState } from 'react';
import { listDistributorBalances, type DistributorBalanceRow } from '../../../lib/distributor';

export default function DistribuidoraSaldoPage() {
  const [rows, setRows] = useState<DistributorBalanceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listDistributorBalances()
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
          <h1 className="page-title">Saldo</h1>
        </div>
      </header>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {rows && rows.length === 0 ? (
        <p className="field-hint">Nenhum produto cadastrado.</p>
      ) : null}
      {rows && rows.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Produto</th>
                <th scope="col">Codigo</th>
                <th scope="col">Variante</th>
                <th scope="col">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.variantId}>
                  <td>{row.productName}</td>
                  <td>{row.internalSku}</td>
                  <td>{row.label}</td>
                  <td>
                    {row.quantity}
                    {row.low ? ' · baixo' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
