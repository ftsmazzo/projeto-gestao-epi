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
            <div className="portal-pick-list" role="list">
              {data.workers.length === 0 ? (
                <p className="page-lead">
                  Nenhum trabalhador cadastrado para esta empresa.
                </p>
              ) : (
                data.workers.map((worker) => (
                  <article key={worker.id} role="listitem" className="portal-pick-card">
                    <div className="portal-pick-card__body portal-pick-card__body--stack">
                      <div className="portal-pick-card__main">
                        <strong className="portal-pick-card__title">
                          {worker.name}
                        </strong>
                        <p className="portal-pick-card__meta mono">
                          {worker.registration ?? 'Sem matricula'}
                        </p>
                        <p className="portal-pick-card__meta">
                          {worker.role || worker.department || 'Sem funcao'}
                          {worker.unitName ? ` · ${worker.unitName}` : ''}
                        </p>
                      </div>
                      <span
                        className={`status-pill status-pill--${
                          worker.status === 'ACTIVE' ? 'active' : 'inactive'
                        }`}
                      >
                        {worker.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                      </span>
                      <div className="btn-row" style={{ marginTop: '0.65rem' }}>
                        <Link
                          className="btn btn-secondary"
                          href={`/portal/trabalhadores/${worker.id}/ficha-epi`}
                        >
                          Ficha de EPI (PDF/imprimir)
                        </Link>
                      </div>
                    </div>
                  </article>
                ))
              )}
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
