'use client';

import { useEffect, useState } from 'react';
import { listDistributorBalances, type DistributorBalanceRow } from '../../../lib/distributor';

function sizeName(label: string) {
  return label.trim() || 'Único';
}

export default function DistribuidoraSaldoPage() {
  const [rows, setRows] = useState<DistributorBalanceRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listDistributorBalances()
      .then(setRows)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  const visible = (rows ?? []).filter((row) => {
    const text = `${row.productName} ${row.internalSku} ${row.label}`.toLocaleLowerCase('pt-BR');
    return text.includes(query.trim().toLocaleLowerCase('pt-BR'));
  });

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Estoque</p>
          <h1 className="page-title">Saldo por tamanho</h1>
          <p className="page-lead">
            Cada linha é um tamanho do produto. Sem tamanho informado, o item aparece como Único.
          </p>
        </div>
      </header>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="busca-saldo">Buscar</label>
        <input
          id="busca-saldo"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nome, código ou tamanho"
        />
      </div>
      {rows && visible.length === 0 ? (
        <p className="field-hint">Nenhum tamanho encontrado.</p>
      ) : null}
      {visible.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Produto</th>
                <th scope="col">Código</th>
                <th scope="col">Tamanho</th>
                <th scope="col">Unidade</th>
                <th scope="col">Quantidade</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.variantId}>
                  <td>{row.productName}</td>
                  <td>{row.internalSku}</td>
                  <td>{sizeName(row.label)}</td>
                  <td>{row.unitCode}</td>
                  <td>{row.quantity}</td>
                  <td>{row.low ? 'Abaixo do mínimo' : 'Ok'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
