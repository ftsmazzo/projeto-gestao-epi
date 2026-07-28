'use client';

import type { PortalTrabalhadoresResponse } from '@gestao-epi/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import { fetchPortalTrabalhadores } from '../../../lib/client-auth';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function daysLabel(daysRemaining: number) {
  if (daysRemaining < 0) {
    const n = Math.abs(daysRemaining);
    return n === 1 ? 'Vencido ha 1 dia' : `Vencido ha ${n} dias`;
  }
  if (daysRemaining === 0) return 'Vence hoje';
  if (daysRemaining === 1) return 'Vence amanha';
  return `Vence em ${daysRemaining} dias`;
}

function PortalTrabalhadoresContent() {
  const searchParams = useSearchParams();
  const filtro = searchParams.get('filtro');
  const onlyDue = filtro === 'trocas';

  const [data, setData] = useState<PortalTrabalhadoresResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const workers = useMemo(() => {
    if (!data) return [];
    if (!onlyDue) return data.workers;
    return data.workers.filter((w) => w.replacementDue);
  }, [data, onlyDue]);

  return (
    <div className="portal-home">
      <header className="portal-home-header">
        <div>
          <p className="page-kicker">Dia a dia</p>
          <h1 className="page-title page-title--sm">Trabalhadores</h1>
          <p className="page-lead">
            {onlyDue
              ? `Filtro: EPIs com troca em ate ${data?.replacementHorizon.warnDays ?? 5} dias (critico em ${data?.replacementHorizon.criticalDays ?? 3} dias).`
              : 'Vidas desta empresa. Quem tem EPI vencendo aparece sinalizado.'}
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
              <span className="quota-summary-label">Troca proxima</span>
              <strong className="quota-summary-value">
                {data.summary.withReplacementDue}
              </strong>
            </div>
          </section>

          <div className="btn-row" style={{ marginBottom: '0.75rem' }}>
            {onlyDue ? (
              <Link className="btn btn-secondary" href="/portal/trabalhadores">
                Ver todos
              </Link>
            ) : data.summary.withReplacementDue > 0 ? (
              <Link
                className="btn btn-secondary"
                href="/portal/trabalhadores?filtro=trocas"
              >
                So com EPI vencendo ({data.summary.withReplacementDue})
              </Link>
            ) : null}
            <Link className="btn btn-secondary" href="/portal">
              Voltar ao painel
            </Link>
          </div>

          <section className="portal-card">
            <div className="portal-pick-list" role="list">
              {workers.length === 0 ? (
                <p className="page-lead">
                  {onlyDue
                    ? 'Nenhum trabalhador com EPI vencendo no horizonte de alerta.'
                    : 'Nenhum trabalhador cadastrado para esta empresa.'}
                </p>
              ) : (
                workers.map((worker) => {
                  const due = worker.replacementDue;
                  const expanded = expandedId === worker.id;
                  return (
                    <article
                      key={worker.id}
                      role="listitem"
                      className={`portal-pick-card${due ? ' portal-pick-card--due' : ''}${due?.tone === 'critical' ? ' portal-pick-card--due-critical' : ''}`}
                    >
                      <div className="portal-pick-card__body portal-pick-card__body--stack">
                        <div className="portal-pick-card__main">
                          <div className="portal-pick-card__title-row">
                            <strong className="portal-pick-card__title">
                              {worker.name}
                            </strong>
                            {due ? (
                              <span
                                className={`status-pill ${
                                  due.tone === 'critical'
                                    ? 'status-pill--critical'
                                    : 'status-pill--warn'
                                }`}
                              >
                                {due.tone === 'critical'
                                  ? `Troca urgente (${due.count})`
                                  : `Troca proxima (${due.count})`}
                              </span>
                            ) : null}
                          </div>
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
                          {due ? (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() =>
                                setExpandedId(expanded ? null : worker.id)
                              }
                              aria-expanded={expanded}
                            >
                              {expanded
                                ? 'Ocultar EPIs vencendo'
                                : `Ver EPIs vencendo (${due.count})`}
                            </button>
                          ) : null}
                          <Link
                            className="btn btn-secondary"
                            href={`/portal/trabalhadores/${worker.id}/ficha-epi`}
                          >
                            Ficha de EPI
                          </Link>
                        </div>

                        {due && expanded ? (
                          <div className="portal-due-epis" role="region">
                            <p className="portal-due-epis__title">
                              EPIs com troca no horizonte
                            </p>
                            <ul className="portal-due-epis__list">
                              {due.items.map((item) => (
                                <li key={item.id} className="portal-due-epis__item">
                                  <div>
                                    <strong>{item.epiName}</strong>
                                    <span className="portal-pick-card__meta">
                                      {item.needName}
                                      {item.caNumber
                                        ? ` · CA ${item.caNumber}`
                                        : ''}
                                    </span>
                                    <span className="portal-pick-card__meta">
                                      Entrega {item.receiptNumber}
                                      {item.usefulLifeLabel
                                        ? ` · Vida util ${item.usefulLifeLabel}`
                                        : ''}
                                    </span>
                                  </div>
                                  <div className="portal-due-epis__meta">
                                    <span
                                      className={`status-pill ${
                                        item.tone === 'critical'
                                          ? 'status-pill--critical'
                                          : 'status-pill--warn'
                                      }`}
                                    >
                                      {daysLabel(item.daysRemaining)}
                                    </span>
                                    <span className="portal-pick-card__meta mono">
                                      Prox. troca{' '}
                                      {formatDate(item.nextReplacementAt)}
                                    </span>
                                    <Link
                                      className="btn btn-ghost"
                                      href={`/portal/entregas/${item.deliveryId}`}
                                    >
                                      Ver entrega
                                    </Link>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              )}
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
      {() => (
        <Suspense fallback={<p className="page-lead">Carregando...</p>}>
          <PortalTrabalhadoresContent />
        </Suspense>
      )}
    </RequireClientAuth>
  );
}
