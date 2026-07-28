'use client';

import type {
  PortalTrabalhadorReplacementDue,
  PortalTrabalhadoresResponse,
} from '@gestao-epi/shared';
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

function actionHint(
  due: PortalTrabalhadorReplacementDue,
  criticalDays: number,
) {
  if (due.overdue > 0) {
    return `Ha ${due.overdue} EPI(s) ja vencido(s). Registre a troca agora.`;
  }
  if (due.critical > 0) {
    return `${due.critical} item(ns) critico(s) nos proximos ${criticalDays} dias. Priorize a entrega.`;
  }
  return `${due.warn} item(ns) no horizonte de alerta. Planeje a troca.`;
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
          if (onlyDue) {
            const firstDue = res.workers.find((w) => w.replacementDue);
            if (firstDue) setExpandedId(firstDue.id);
          }
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
  }, [onlyDue]);

  const workers = useMemo(() => {
    if (!data) return [];
    if (!onlyDue) return data.workers;
    return data.workers.filter((w) => w.replacementDue);
  }, [data, onlyDue]);

  const criticalDays = data?.replacementHorizon.criticalDays ?? 3;
  const warnDays = data?.replacementHorizon.warnDays ?? 5;

  return (
    <div className="portal-home">
      <header className="portal-home-header portal-home-header--decision">
        <div className="portal-home-brand">
          <h1 className="portal-home-title">Trabalhadores</h1>
          <p className="portal-home-cnpj">
            {onlyDue
              ? `Filtrado: trocas em ate ${warnDays} dias`
              : 'Quem precisa de troca aparece sinalizado'}
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
          <section
            className="quota-summary quota-summary--compact"
            aria-label="Resumo"
          >
            <div className="quota-summary-item">
              <span className="quota-summary-label">Vidas</span>
              <strong className="quota-summary-value">
                {data.lives.used}/{data.lives.allocated}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Com troca</span>
              <strong className="quota-summary-value">
                {data.summary.withReplacementDue}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Horizonte</span>
              <strong className="quota-summary-value">
                {criticalDays}/{warnDays}d
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
                className="btn btn-primary"
                href="/portal/trabalhadores?filtro=trocas"
              >
                Abrir fila de trocas ({data.summary.withReplacementDue})
              </Link>
            ) : null}
            <Link className="btn btn-secondary" href="/portal">
              Voltar ao painel
            </Link>
          </div>

          <section className="portal-worker-list" aria-label="Lista">
            {workers.length === 0 ? (
              <p className="page-lead">
                {onlyDue
                  ? 'Nenhum trabalhador com EPI vencendo no horizonte.'
                  : 'Nenhum trabalhador cadastrado para esta empresa.'}
              </p>
            ) : (
              workers.map((worker) => {
                const due = worker.replacementDue;
                const expanded = expandedId === worker.id;
                const urgentCount = due
                  ? due.overdue + due.critical
                  : 0;

                return (
                  <article
                    key={worker.id}
                    className={`portal-worker-card${due ? ` portal-worker-card--${due.tone}` : ''}`}
                  >
                    <header className="portal-worker-card__header">
                      <div className="portal-worker-card__identity">
                        <h2 className="portal-worker-card__name">
                          {worker.name}
                        </h2>
                        <p className="portal-worker-card__meta">
                          <span className="mono">
                            {worker.registration ?? 'Sem matricula'}
                          </span>
                          {' · '}
                          {worker.role || worker.department || 'Sem funcao'}
                          {worker.unitName ? ` · ${worker.unitName}` : ''}
                        </p>
                      </div>
                      <div className="portal-worker-card__flags">
                        <span
                          className={`status-pill status-pill--${
                            worker.status === 'ACTIVE' ? 'active' : 'inactive'
                          }`}
                        >
                          {worker.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                        </span>
                        {due ? (
                          <span
                            className={`status-pill ${
                              due.tone === 'critical'
                                ? 'status-pill--critical'
                                : 'status-pill--warn'
                            }`}
                          >
                            {due.tone === 'critical'
                              ? `Urgente · ${due.count}`
                              : `Proxima · ${due.count}`}
                          </span>
                        ) : null}
                      </div>
                    </header>

                    {due ? (
                      <p className="portal-worker-card__hint" role="status">
                        {actionHint(due, criticalDays)}
                        {urgentCount > 0
                          ? ` · ${urgentCount} prioritario(s)`
                          : ''}
                      </p>
                    ) : null}

                    <div className="portal-worker-card__actions">
                      {due ? (
                        <>
                          <Link
                            className="btn btn-primary"
                            href={`/portal/entregas?worker=${worker.id}`}
                          >
                            Registrar troca
                          </Link>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() =>
                              setExpandedId(expanded ? null : worker.id)
                            }
                            aria-expanded={expanded}
                          >
                            {expanded
                              ? 'Ocultar itens'
                              : `Ver ${due.count} EPI(s)`}
                          </button>
                        </>
                      ) : null}
                      <Link
                        className="btn btn-secondary"
                        href={`/portal/trabalhadores/${worker.id}/ficha-epi`}
                      >
                        Ficha de EPI
                      </Link>
                    </div>

                    {due && expanded ? (
                      <div className="portal-due-panel" role="region">
                        <div className="portal-due-panel__summary">
                          {[
                            due.overdue > 0
                              ? `${due.overdue} vencido(s)`
                              : null,
                            due.critical > 0
                              ? `${due.critical} em ate ${criticalDays}d`
                              : null,
                            due.warn > 0
                              ? `${due.warn} em ate ${warnDays}d`
                              : null,
                          ]
                            .filter(Boolean)
                            .map((label) => (
                              <span key={String(label)}>{label}</span>
                            ))}
                        </div>
                        <ul className="portal-due-panel__list">
                          {due.items.map((item) => (
                            <li
                              key={item.id}
                              className={`portal-due-row portal-due-row--${item.tone}`}
                            >
                              <div className="portal-due-row__main">
                                <strong className="portal-due-row__name">
                                  {item.epiName}
                                </strong>
                                <p className="portal-due-row__meta">
                                  {item.needName}
                                  {item.caNumber
                                    ? ` · CA ${item.caNumber}`
                                    : ''}
                                </p>
                              </div>
                              <div className="portal-due-row__status">
                                <span
                                  className={`status-pill ${
                                    item.tone === 'critical'
                                      ? 'status-pill--critical'
                                      : 'status-pill--warn'
                                  }`}
                                >
                                  {daysLabel(item.daysRemaining)}
                                </span>
                                <span className="portal-due-row__date mono">
                                  {formatDate(item.nextReplacementAt)}
                                </span>
                              </div>
                              <div className="portal-due-row__actions">
                                <Link
                                  className="btn btn-primary btn-sm"
                                  href={`/portal/entregas?worker=${worker.id}`}
                                >
                                  Trocar
                                </Link>
                                <Link
                                  className="btn btn-ghost btn-sm"
                                  href={`/portal/entregas/${item.deliveryId}`}
                                >
                                  Entrega
                                </Link>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
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
