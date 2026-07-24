'use client';

import type { PortalEstoqueResponse } from '@gestao-epi/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import { fetchPortalEstoque } from '../../../lib/client-auth';

function PortalEstoqueContent() {
  const [data, setData] = useState<PortalEstoqueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchPortalEstoque()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Falha ao carregar estoque.',
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="portal-home">
      <header className="portal-home-header">
        <div>
          <p className="page-kicker">Dia a dia</p>
          <h1 className="page-title page-title--sm">Estoque</h1>
          <p className="page-lead">
            Necessidades desta empresa e EPIs vinculados pela Consultoria.
            Saldo fisico por empresa entra na proxima etapa.
          </p>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="page-lead">Carregando estoque...</p> : null}

      {data ? (
        <>
          <div className="notice notice--info" role="status">
            <p>{data.note}</p>
          </div>

          <section className="quota-summary" aria-label="Resumo de estoque">
            <div className="quota-summary-item">
              <span className="quota-summary-label">Necessidades</span>
              <strong className="quota-summary-value">{data.summary.needs}</strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Com EPI vinculado</span>
              <strong className="quota-summary-value">
                {data.summary.withLinkedEpi}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Sem EPI</span>
              <strong className="quota-summary-value">
                {data.summary.withoutLinkedEpi}
              </strong>
            </div>
          </section>

          <section className="portal-card">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Necessidade</th>
                    <th scope="col">Funcoes</th>
                    <th scope="col">EPIs vinculados</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.needs.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        Nenhuma necessidade ativa nas funcoes desta empresa.
                      </td>
                    </tr>
                  ) : (
                    data.needs.map((need) => (
                      <tr key={need.needId}>
                        <td>
                          <strong>{need.needName}</strong>
                        </td>
                        <td>{need.jobNames.join(', ') || '—'}</td>
                        <td>
                          {need.items.length === 0 ? (
                            '—'
                          ) : (
                            <ul className="upcoming-list">
                              {need.items.map((item) => (
                                <li key={item.id}>
                                  {item.name}
                                  {item.caNumber
                                    ? ` (CA ${item.caNumber})`
                                    : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-pill status-pill--${
                              need.hasLinkedEpi ? 'active' : 'inactive'
                            }`}
                          >
                            {need.hasLinkedEpi
                              ? 'EPI vinculado'
                              : 'Aguardando vinculo'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="btn-row" style={{ marginTop: '1rem' }}>
              <Link className="btn btn-secondary" href="/portal">
                Voltar ao painel
              </Link>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function PortalEstoquePage() {
  return (
    <RequireClientAuth>
      {() => <PortalEstoqueContent />}
    </RequireClientAuth>
  );
}
