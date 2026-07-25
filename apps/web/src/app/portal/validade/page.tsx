'use client';

import type {
  PortalValidadeResponse,
  PortalValidityBucket,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import { fetchPortalValidade } from '../../../lib/client-auth';

function bucketLabel(bucket: PortalValidityBucket) {
  if (bucket === 'expired') return 'Vencido';
  if (bucket === 'soon') return 'A vencer';
  if (bucket === 'missing') return 'Sem CA';
  return 'Em dia';
}

function bucketClass(bucket: PortalValidityBucket) {
  if (bucket === 'expired') return 'status-pill status-pill--warn';
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

  useEffect(() => {
    let cancelled = false;
    void fetchPortalValidade()
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
              : 'Falha ao carregar validades.',
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
          <h1 className="page-title page-title--sm">Validade</h1>
          <p className="page-lead">
            CAs e vinculos de EPI das funcoes desta empresa. Horizonte de
            alerta: {data?.summary.horizonDays ?? 90} dias.
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

          <section className="portal-card">
            {data.items.length === 0 ? (
              <p className="page-lead">
                Nenhuma necessidade com EPI vinculado ainda. A Consultoria
                define isso na Estrutura / PGRO.
              </p>
            ) : (
              <div className="stack-list" role="list" aria-label="Validades">
                {data.items.map((item) => (
                  <article key={item.epiItemId} role="listitem" className="stack-card">
                    <div className="stack-card__body stack-card__body--stack">
                      <div className="stack-card__main">
                        <strong className="stack-card__title">{item.epiName}</strong>
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
