'use client';

import Link from 'next/link';
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
          <p className="page-kicker">Depósito</p>
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
      {rows === null && !error ? (
        <p className="field-hint" role="status" aria-live="polite">
          Carregando saldo…
        </p>
      ) : null}
      {rows && rows.length === 0 ? (
        <div className="empty-state dash-panel">
          <h2 className="page-title">Nenhum tamanho no depósito</h2>
          <p className="page-lead">
            Cadastre produtos (ou gere o catálogo demo) e registre a primeira entrada.
          </p>
          <div className="header-actions header-actions--wrap">
            <Link className="btn btn-primary" href="/distribuidora/produtos">
              Abrir produtos
            </Link>
            <Link className="btn btn-secondary" href="/distribuidora/entrada">
              Registrar entrada
            </Link>
          </div>
        </div>
      ) : null}
      {rows && rows.length > 0 && visible.length === 0 ? (
        <p className="field-hint">Nenhum tamanho encontrado para essa busca.</p>
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
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.variantId}
                  className={row.low ? 'data-table__row--warn' : undefined}
                >
                  <td>{row.productName}</td>
                  <td>{row.internalSku}</td>
                  <td>{sizeName(row.label)}</td>
                  <td>{row.unitCode}</td>
                  <td>{row.quantity}</td>
                  <td>
                    {row.low ? (
                      <span className="dash-kpi__hint" style={{ color: 'inherit', fontWeight: 600 }}>
                        Abaixo do mínimo
                      </span>
                    ) : (
                      'Ok'
                    )}
                  </td>
                  <td>
                    <Link href="/distribuidora/entrada">Entrada</Link>
                    {' · '}
                    <Link href="/distribuidora/saida">Saída</Link>
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
