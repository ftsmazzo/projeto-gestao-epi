'use client';

import type { PortalTrabalhadoresResponse } from '@gestao-epi/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import { fetchPortalTrabalhadores } from '../../../lib/client-auth';

function PortalTrabalhadoresContent() {
  const [data, setData] = useState<PortalTrabalhadoresResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchPortalTrabalhadores()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Falha ao carregar trabalhadores.',
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
          <h1 className="page-title page-title--sm">Trabalhadores</h1>
          <p className="page-lead">
            Vidas desta empresa. Cadastro operacional completo segue nas
            proximas etapas; aqui a consulta do que ja foi implantado.
          </p>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="page-lead">Carregando trabalhadores...</p>
      ) : null}

      {data ? (
        <>
          <section className="quota-summary" aria-label="Cota de vidas">
            <div className="quota-summary-item">
              <span className="quota-summary-label">Alocadas</span>
              <strong className="quota-summary-value">
                {data.lives.allocated}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Em uso</span>
              <strong className="quota-summary-value">{data.lives.used}</strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Disponiveis</span>
              <strong className="quota-summary-value">
                {data.lives.available}
              </strong>
            </div>
          </section>

          <section className="portal-card">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">Matricula</th>
                    <th scope="col">Funcao / depto</th>
                    <th scope="col">Unidade</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.workers.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        Nenhum trabalhador cadastrado para esta empresa.
                      </td>
                    </tr>
                  ) : (
                    data.workers.map((worker) => (
                      <tr key={worker.id}>
                        <td>
                          <strong>{worker.name}</strong>
                        </td>
                        <td className="mono">
                          {worker.registration ?? '—'}
                        </td>
                        <td>
                          {worker.role || worker.department || '—'}
                          {worker.role && worker.department ? (
                            <span className="table-sub">
                              {worker.department}
                            </span>
                          ) : null}
                        </td>
                        <td>{worker.unitName ?? '—'}</td>
                        <td>
                          <span
                            className={`status-pill status-pill--${
                              worker.status === 'ACTIVE'
                                ? 'active'
                                : 'inactive'
                            }`}
                          >
                            {worker.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
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

export default function PortalTrabalhadoresPage() {
  return (
    <RequireClientAuth>
      {() => <PortalTrabalhadoresContent />}
    </RequireClientAuth>
  );
}
