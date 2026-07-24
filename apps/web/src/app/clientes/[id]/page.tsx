'use client';

import type { ServedClientOverview } from '@gestao-epi/shared';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getServedClientOverview } from '../../../lib/served-clients';

export default function ClienteVisaoGeralPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const [overview, setOverview] = useState<ServedClientOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const ov = await getServedClientOverview(clientId);
      setOverview(ov);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar a visao geral.',
      );
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !overview) {
    return <p className="page-lead">Carregando visao geral...</p>;
  }

  if (error || !overview) {
    return (
      <p className="error" role="alert">
        {error ?? 'Visao geral indisponivel.'}
      </p>
    );
  }

  const { counts, lives, lastPgroImport, operational } = overview;

  return (
    <div className="workspace-section">
      {!operational ? (
        <div className="notice notice--warn" role="status">
          <p>
            Cliente <strong>inativo</strong>. Reative na lista de clientes para
            operar estrutura, usuarios e vidas.
          </p>
        </div>
      ) : null}

      <section className="surface" aria-labelledby="overview-title">
        <p className="page-kicker">Resumo</p>
        <h2 id="overview-title" className="page-title page-title--sm">
          Visao geral
        </h2>

        <div className="overview-metrics" aria-label="Indicadores">
          <div className="overview-metric">
            <span className="overview-metric__label">Vidas</span>
            <strong className="overview-metric__value">
              {lives.used}/{lives.allocated}
            </strong>
            <span className="overview-metric__hint">
              {lives.available} disponiveis
            </span>
          </div>
          <div className="overview-metric">
            <span className="overview-metric__label">Setores</span>
            <strong className="overview-metric__value">
              {counts.sectors.active}
            </strong>
          </div>
          <div className="overview-metric">
            <span className="overview-metric__label">Funcoes</span>
            <strong className="overview-metric__value">
              {counts.jobFunctions.active}
            </strong>
          </div>
          <div className="overview-metric">
            <span className="overview-metric__label">Gestores</span>
            <strong className="overview-metric__value">
              {counts.users.managers.active}/{counts.users.managers.limit}
            </strong>
          </div>
          <div className="overview-metric">
            <span className="overview-metric__label">Op. estoque</span>
            <strong className="overview-metric__value">
              {counts.users.stockOperators.active}/
              {counts.users.stockOperators.limit}
            </strong>
          </div>
        </div>

        {lastPgroImport ? (
          <p className="overview-pgro">
            Ultimo PGRO: Arquivo {lastPgroImport.fileName} ·{' '}
            {lastPgroImport.status} ·{' '}
            {new Date(lastPgroImport.createdAt).toLocaleString('pt-BR')}
            {lastPgroImport.createdByEmail
              ? ` · ${lastPgroImport.createdByEmail}`
              : null}
          </p>
        ) : (
          <p className="overview-pgro">Nenhuma importacao PGRO neste cliente.</p>
        )}
      </section>
    </div>
  );
}
