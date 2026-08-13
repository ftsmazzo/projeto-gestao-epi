'use client';

import type {
  QuotaSummary,
  ServedClientOverview,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  dailyAlertsResultMessage,
  runDailyClientAlerts,
} from '../../../lib/communications';
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
  const [alertSending, setAlertSending] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

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

  async function onSendDailyAlert() {
    if (!clientId || !operational) return;
    const confirmed = window.confirm(
      'Enviar alerta diario de teste (EPI/CA/biometria) por e-mail/WhatsApp aos contatos e gestores deste cliente?',
    );
    if (!confirmed) return;
    setAlertSending(true);
    setAlertMessage(null);
    setError(null);
    try {
      const result = await runDailyClientAlerts(clientId);
      setAlertMessage(dailyAlertsResultMessage(result));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel disparar o alerta.',
      );
    } finally {
      setAlertSending(false);
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

  const hasStructure =
    counts.sectors.active > 0 ||
    counts.jobFunctions.active > 0 ||
    counts.epiNeeds.active > 0;
  const hasWorkers = counts.workers.active > 0;
  const hasManagers = counts.users.managers.active > 0;
  const nextHref = !hasStructure
    ? `/clientes/${clientId}/estrutura`
    : !hasWorkers
      ? `/clientes/${clientId}/trabalhadores`
      : !hasManagers
        ? `/clientes/${clientId}/usuarios`
        : `/clientes/${clientId}/usuarios`;
  const nextTitle = !hasStructure
    ? 'Importar ou montar estrutura'
    : !hasWorkers
      ? 'Cadastrar trabalhadores'
      : !hasManagers
        ? 'Criar acesso ao portal'
        : 'Revisar usuarios do portal';
  const nextDesc = !hasStructure
    ? 'Comece pelo PGR ou cadastre setores e necessidades.'
    : !hasWorkers
      ? 'Cadastre as vidas que consomem a cota deste cliente.'
      : !hasManagers
        ? 'Libere gestor/operador para operar no painel.'
        : 'Cliente pronto — revise acessos e acompanhe a operacao.';

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

      <section className="action-strip" aria-label="Proximo passo da implantacao">
        <Link href={nextHref} className="action-tile action-tile--primary">
          <p className="action-tile__kicker">Proximo passo</p>
          <h2 className="action-tile__title">{nextTitle}</h2>
          <p className="action-tile__desc">{nextDesc}</p>
        </Link>
        <Link
          href={`/clientes/${clientId}/atualizar-pgro`}
          className="action-tile"
        >
          <p className="action-tile__kicker">PGR</p>
          <h2 className="action-tile__title">
            {lastPgroImport ? 'Atualizar PGR' : 'Importar PGR'}
          </h2>
          <p className="action-tile__desc">
            {lastPgroImport
              ? `Ultimo: ${lastPgroImport.fileName}`
              : 'Extrair setores, funcoes, riscos e EPIs do PDF.'}
          </p>
        </Link>
        <Link href={`/clientes/${clientId}/usuarios`} className="action-tile">
          <p className="action-tile__kicker">Portal</p>
          <h2 className="action-tile__title">Usuarios do cliente</h2>
          <p className="action-tile__desc">
            Gestores {counts.users.managers.active}/
            {counts.users.managers.limit} · Estoque{' '}
            {counts.users.stockOperators.active}/
            {counts.users.stockOperators.limit}
          </p>
        </Link>
      </section>

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
            Ultimo PGR: Arquivo {lastPgroImport.fileName} ·{' '}
            {lastPgroImport.status} ·{' '}
            {new Date(lastPgroImport.createdAt).toLocaleString('pt-BR')}
            {lastPgroImport.createdByEmail
              ? ` · ${lastPgroImport.createdByEmail}`
              : null}
          </p>
        ) : (
          <p className="overview-pgro">
            Nenhuma importacao PGR neste cliente.{' '}
            <Link href={`/clientes/${clientId}/estrutura`}>
              Abrir estrutura
            </Link>
          </p>
        )}
      </section>

      {operational ? (
        <section className="surface" aria-labelledby="alerts-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Comunicacoes</p>
              <h2 id="alerts-title" className="page-title page-title--sm">
                Alerta diario
              </h2>
              <p className="page-lead">
                Dispara agora o mesmo digest do cron (~08:00 BRT): trocas de
                EPI, CA e biometria pendente, para o contato institucional e
                gestores. Dedupe: no maximo 1 envio por destinatario/canal no
                dia.
              </p>
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={alertSending}
                onClick={() => void onSendDailyAlert()}
              >
                {alertSending ? 'Enviando...' : 'Enviar alerta de teste'}
              </button>
            </div>
          </div>
          {alertMessage ? (
            <p className="field-hint" role="status">
              {alertMessage}
            </p>
          ) : null}
          {error && overview ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
