'use client';

import type {
  PortalValidadeResponse,
  PortalValidityBucket,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import { fetchPortalValidade } from '../../../lib/client-auth';

type BucketFilter = 'all' | PortalValidityBucket;

function bucketLabel(bucket: PortalValidityBucket) {
  if (bucket === 'expired') return 'Vencido';
  if (bucket === 'soon') return 'A vencer';
  if (bucket === 'missing') return 'Sem CA';
  return 'Em dia';
}

function bucketClass(bucket: PortalValidityBucket) {
  if (bucket === 'expired') return 'status-pill status-pill--critical';
  if (bucket === 'soon') return 'status-pill status-pill--warn';
  if (bucket === 'missing') return 'status-pill status-pill--inactive';
  return 'status-pill status-pill--active';
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

function PortalValidadeContent() {
  const [data, setData] = useState<PortalValidadeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BucketFilter>('all');

  useEffect(() => {
    let cancelled = false;
    void fetchPortalValidade()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
          if (res.summary.expired > 0) setFilter('expired');
          else if (res.summary.soon > 0) setFilter('soon');
          else if (res.summary.missing > 0) setFilter('missing');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Falha ao carregar validades.',
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.items;
    return data.items.filter((item) => item.bucket === filter);
  }, [data, filter]);

  const attentionCount =
    (data?.summary.expired ?? 0) +
    (data?.summary.soon ?? 0) +
    (data?.summary.missing ?? 0);

  return (
    <div className="portal-home">
      <header className="portal-home-header portal-home-header--decision">
        <div>
          <p className="page-kicker">Dia a dia</p>
          <h1 className="page-title page-title--sm">Validade</h1>
          <p className="page-lead">
            CAs e vinculos de EPI das funcoes. Horizonte:{' '}
            {data?.summary.horizonDays ?? 90} dias
            {attentionCount > 0
              ? ` · ${attentionCount} item(ns) pedem atencao`
              : ''}.
          </p>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="page-lead">Carregando validades...</p> : null}

      {data ? (
        <>
          <section className="quota-summary" aria-label="Resumo de validade">
            <div className="quota-summary-item">
              <span className="quota-summary-label">Vencidos</span>
              <strong className="quota-summary-value">
                {data.summary.expired}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">A vencer</span>
              <strong className="quota-summary-value">{data.summary.soon}</strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Sem CA</span>
              <strong className="quota-summary-value">
                {data.summary.missing}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Em dia</span>
              <strong className="quota-summary-value">{data.summary.ok}</strong>
            </div>
          </section>

          <div
            className="portal-section-tabs"
            role="tablist"
            aria-label="Filtrar validade"
          >
            {(
              [
                ['all', 'Todos'],
                ['expired', 'Vencidos'],
                ['soon', 'A vencer'],
                ['missing', 'Sem CA'],
                ['ok', 'Em dia'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={`portal-section-tab ${filter === id ? 'is-active' : ''}`}
                aria-selected={filter === id}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <section className="portal-card">
            {data.items.length === 0 ? (
              <div className="empty-state">
                <p className="page-title page-title--sm">
                  Nenhuma validade para acompanhar
                </p>
                <p className="page-lead">
                  A Consultoria precisa vincular EPIs na estrutura/PGRO. Depois
                  registre entradas no estoque.
                </p>
                <Link className="btn btn-primary" href="/portal/estoque">
                  Ir ao estoque
                </Link>
              </div>
            ) : items.length === 0 ? (
              <div className="empty-state">
                <p className="page-lead">Nenhum item neste filtro.</p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFilter('all')}
                >
                  Ver todos
                </button>
              </div>
            ) : (
              <div className="stack-list" role="list" aria-label="Validades">
                {items.map((item) => (
                  <article
                    key={item.epiItemId}
                    role="listitem"
                    className="stack-card"
                  >
                    <div className="stack-card__body stack-card__body--stack">
                      <div className="stack-card__main">
                        <strong className="stack-card__title">
                          {item.epiName}
                        </strong>
                        {item.needNames.length > 0 ? (
                          <p className="stack-card__meta">
                            {item.needNames.join(', ')}
                          </p>
                        ) : null}
                        <p className="stack-card__meta mono">
                          CA {item.caNumber ?? '—'}
                          {' · '}
                          {formatDate(item.caExpiresAt)}
                          {item.daysRemaining != null
                            ? item.daysRemaining < 0
                              ? ` · ${Math.abs(item.daysRemaining)} dia(s) atras`
                              : ` · ${item.daysRemaining} dia(s)`
                            : ''}
                        </p>
                        <p className="stack-card__meta">
                          Funcoes: {item.jobNames.join(', ') || '—'}
                        </p>
                        <span
                          className={bucketClass(item.bucket)}
                          style={{ marginTop: '0.45rem' }}
                        >
                          {bucketLabel(item.bucket)}
                        </span>
                      </div>
                      {(item.bucket === 'expired' ||
                        item.bucket === 'soon' ||
                        item.bucket === 'missing') && (
                        <div className="stack-card__actions">
                          <Link
                            className="btn btn-secondary btn-sm"
                            href="/portal/estoque"
                          >
                            Revisar estoque
                          </Link>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
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

export default function PortalValidadePage() {
  return (
    <RequireClientAuth>
      {() => <PortalValidadeContent />}
    </RequireClientAuth>
  );
}
