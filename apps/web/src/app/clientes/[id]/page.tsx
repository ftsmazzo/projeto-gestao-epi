'use client';

import type {
  QuotaSummary,
  ServedClientOverview,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getQuotaSummary,
  getServedClientOverview,
  updateServedClient,
} from '../../../lib/served-clients';

export default function ClienteVisaoGeralPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const [overview, setOverview] = useState<ServedClientOverview | null>(null);
  const [quota, setQuota] = useState<QuotaSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingQuota, setEditingQuota] = useState(false);
  const [quotaInput, setQuotaInput] = useState('0');
  const [savingQuota, setSavingQuota] = useState(false);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const [ov, qs] = await Promise.all([
        getServedClientOverview(clientId),
        getQuotaSummary(),
      ]);
      setOverview(ov);
      setQuota(qs);
      setQuotaInput(String(ov.lives.allocated));
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

  async function onSaveQuota(event: FormEvent) {
    event.preventDefault();
    if (!clientId || !overview) return;
    const next = Number(quotaInput);
    if (!Number.isFinite(next) || next < 0 || !Number.isInteger(next)) {
      setError('Informe uma cota inteira maior ou igual a zero.');
      return;
    }
    setSavingQuota(true);
    setError(null);
    setQuotaMessage(null);
    try {
      await updateServedClient(clientId, { allocatedLifeQuota: next });
      setQuotaMessage('Cota de vidas atualizada.');
      setEditingQuota(false);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel atualizar a cota.',
      );
    } finally {
      setSavingQuota(false);
    }
  }

  if (loading && !overview) {
    return <p className="page-lead">Carregando visao geral...</p>;
  }

  if ((error && !overview) || !overview) {
    return (
      <p className="error" role="alert">
        {error ?? 'Visao geral indisponivel.'}
      </p>
    );
  }

  const { counts, lives, lastPgroImport, operational } = overview;
  const franchiseAvailable = quota
    ? Math.max(0, quota.contracted - quota.allocated)
    : null;
  const maxForThisClient =
    franchiseAvailable === null
      ? null
      : franchiseAvailable + overview.lives.allocated;

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
        <div className="form-section-header">
          <div>
            <p className="page-kicker">Resumo</p>
            <h2 id="overview-title" className="page-title page-title--sm">
              Visao geral
            </h2>
          </div>
          {!editingQuota ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setEditingQuota(true);
                setQuotaInput(String(lives.allocated));
                setQuotaMessage(null);
                setError(null);
              }}
            >
              Editar cota de vidas
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {quotaMessage ? (
          <p className="notice notice--info" role="status">
            {quotaMessage}
          </p>
        ) : null}

        <div className="overview-metrics" aria-label="Indicadores">
          <div className="overview-metric">
            <span className="overview-metric__label">Vidas</span>
            <strong className="overview-metric__value">
              {lives.used}/{lives.allocated}
            </strong>
            <span className="overview-metric__hint">
              {lives.available} disponiveis neste cliente
            </span>
          </div>
          {quota ? (
            <div className="overview-metric">
              <span className="overview-metric__label">Franquia tenant</span>
              <strong className="overview-metric__value">
                {quota.allocated}/{quota.contracted}
              </strong>
              <span className="overview-metric__hint">
                {quota.available} vidas ainda nao alocadas
              </span>
            </div>
          ) : null}
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

        {editingQuota ? (
          <form className="form-panel" onSubmit={onSaveQuota} style={{ marginTop: '1rem' }}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="client-life-quota">Cota de vidas deste cliente</label>
                <input
                  id="client-life-quota"
                  type="number"
                  min={lives.used}
                  max={maxForThisClient ?? undefined}
                  required
                  value={quotaInput}
                  onChange={(e) => setQuotaInput(e.target.value)}
                />
                <p className="field-hint">
                  Minimo: {lives.used} (trabalhadores ACTIVE).
                  {maxForThisClient !== null
                    ? ` Maximo pela franquia: ${maxForThisClient}.`
                    : ''}
                </p>
              </div>
            </div>
            <div className="btn-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingQuota}
              >
                {savingQuota ? 'Salvando...' : 'Salvar cota'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={savingQuota}
                onClick={() => {
                  setEditingQuota(false);
                  setQuotaInput(String(lives.allocated));
                  setError(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

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
          <p className="overview-pgro">
            Nenhuma importacao PGRO neste cliente.{' '}
            <Link href={`/clientes/${clientId}/estrutura`}>
              Abrir estrutura
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
