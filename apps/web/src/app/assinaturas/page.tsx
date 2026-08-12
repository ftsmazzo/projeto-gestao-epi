'use client';

import type {
  AuthUser,
  ClientSubscriptionRow,
  ClientSubscriptionStatus,
  LifePriceReducer,
  SubscriptionsOverview,
} from '@gestao-epi/shared';
import {
  buildLifePriceQuote,
  clientSubscriptionStatusLabel,
  formatBrlFromCents,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import {
  activateClientSubscription,
  adjustClientMonthly,
  centsToReaisInput,
  getSubscriptionsOverview,
  grantClientLives,
  markClientPastDue,
  reaisToCents,
  reactivateClientSubscription,
  replaceLifeReducers,
  startClientTrial,
  suspendClientSubscription,
  updateLifePricing,
} from '../../lib/subscriptions';

type FilterId = 'all' | 'trial' | 'active' | 'past_due' | 'suspended' | 'none';

function isAdminRole(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

function pillClass(status: ClientSubscriptionStatus | null) {
  switch (status) {
    case 'ACTIVE':
      return 'status-pill status-pill--active';
    case 'TRIAL':
      return 'status-pill status-pill--info';
    case 'PAST_DUE':
      return 'status-pill status-pill--warn';
    case 'SUSPENDED':
      return 'status-pill status-pill--critical';
    default:
      return 'status-pill status-pill--inactive';
  }
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

export default function AssinaturasPage() {
  return (
    <RequireAuth>
      {(user) => (
        <Suspense
          fallback={
            <p className="field-hint" role="status">
              Carregando assinaturas...
            </p>
          }
        >
          <AssinaturasContent user={user} />
        </Suspense>
      )}
    </RequireAuth>
  );
}

function AssinaturasContent({ user }: { user: AuthUser }) {
  const searchParams = useSearchParams();
  const canManage = isAdminRole(user.membershipRole);
  const [data, setData] = useState<SubscriptionsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('cliente'),
  );

  const [unitPrice, setUnitPrice] = useState('');
  const [trialDays, setTrialDays] = useState('14');
  const [trialLives, setTrialLives] = useState('5');
  const [franchise, setFranchise] = useState('0');
  const [reducers, setReducers] = useState<
    Array<{ minLives: string; percentOff: string; label: string }>
  >([]);
  const [previewLives, setPreviewLives] = useState('100');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getSubscriptionsOverview();
      setData(next);
      setUnitPrice(centsToReaisInput(next.pricing.unitPriceCents));
      setTrialDays(String(next.pricing.defaultTrialDays));
      setTrialLives(String(next.pricing.defaultTrialLives));
      setFranchise(String(next.quota.contracted));
      setReducers(
        next.pricing.reducers.map((item) => ({
          minLives: String(item.minLives),
          percentOff: String(item.percentOff),
          label: item.label ?? '',
        })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao carregar assinaturas.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => data?.clients.find((row) => row.clientId === selectedId) ?? null,
    [data, selectedId],
  );

  const filtered = useMemo(() => {
    const rows = data?.clients ?? [];
    switch (filter) {
      case 'trial':
        return rows.filter((row) => row.subscription?.status === 'TRIAL');
      case 'active':
        return rows.filter((row) => row.subscription?.status === 'ACTIVE');
      case 'past_due':
        return rows.filter((row) => row.subscription?.status === 'PAST_DUE');
      case 'suspended':
        return rows.filter((row) => row.subscription?.status === 'SUSPENDED');
      case 'none':
        return rows.filter((row) => !row.subscription);
      default:
        return rows;
    }
  }, [data, filter]);

  const previewQuote = useMemo(() => {
    if (!data) return null;
    const lives = Number(previewLives) || 0;
    const cents = reaisToCents(unitPrice) ?? data.pricing.unitPriceCents;
    return buildLifePriceQuote({
      unitPriceCents: cents,
      lives,
      reducers: data.pricing.reducers,
    });
  }, [data, previewLives, unitPrice]);

  async function run(action: () => Promise<SubscriptionsOverview>, ok: string) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const next = await action();
      setData(next);
      setNotice(ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function onSavePricing(event: FormEvent) {
    event.preventDefault();
    const cents = reaisToCents(unitPrice);
    if (cents === null) {
      setError('Informe um custo de vida valido (ex.: 1,20).');
      return;
    }
    await run(
      () =>
        updateLifePricing({
          unitPriceCents: cents,
          defaultTrialDays: Number(trialDays) || 14,
          defaultTrialLives: Number(trialLives) || 5,
          contractedLifeQuota: Number(franchise) || 0,
        }),
      'Tabela de preco e franquia atualizadas.',
    );
  }

  async function onSaveReducers(event: FormEvent) {
    event.preventDefault();
    const items: Array<{
      minLives: number;
      percentOff: number;
      label?: string;
    }> = [];
    for (const row of reducers) {
      const minLives = Number(row.minLives);
      const percentOff = Number(row.percentOff);
      if (!minLives || !percentOff) {
        setError('Cada redutor precisa de vidas minimas e percentual.');
        return;
      }
      items.push({
        minLives,
        percentOff,
        label: row.label.trim() || undefined,
      });
    }
    await run(
      () => replaceLifeReducers(items),
      'Redutores de volume atualizados.',
    );
  }

  return (
    <div className="module-page billing-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Consultoria</p>
          <h1 className="page-title">Assinaturas e entradas</h1>
          <p className="page-lead">
            A cobranca e <strong>por vida</strong>: custo da vida × vidas
            contratadas. Exemplo: 100 vidas a R$ 1,20 = R$ 120,00 / mes. Redutor
            de volume e desconto extra em cima disso.
          </p>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="form-success" role="status">
          {notice}
        </p>
      ) : null}

      {loading && !data ? (
        <p className="field-hint">Carregando...</p>
      ) : data ? (
        <>
          <section className="dash-kpi-grid" aria-label="Resumo comercial">
            <article className="dash-kpi">
              <p className="dash-kpi__label">Mensalidade recorrente</p>
              <p className="dash-kpi__value">
                {formatBrlFromCents(data.summary.recurringMonthlyCents)}
              </p>
              <p className="dash-kpi__hint">Ativas + em atraso</p>
            </article>
            <article className="dash-kpi">
              <p className="dash-kpi__label">Franquia de vidas</p>
              <p className="dash-kpi__value">
                {data.quota.allocated}/{data.quota.contracted}
              </p>
              <p className="dash-kpi__hint">
                {data.quota.available} disponiveis para ceder
              </p>
            </article>
            <article className="dash-kpi dash-kpi--ok">
              <p className="dash-kpi__label">Em teste</p>
              <p className="dash-kpi__value">{data.summary.trialCount}</p>
              <p className="dash-kpi__hint">Sem custo enquanto o trial vale</p>
            </article>
            <article className="dash-kpi dash-kpi--warn">
              <p className="dash-kpi__label">Atraso / bloqueio</p>
              <p className="dash-kpi__value">
                {data.summary.pastDueCount + data.summary.suspendedCount}
              </p>
              <p className="dash-kpi__hint">
                {data.summary.suspendedCount} bloqueado(s)
              </p>
            </article>
          </section>

          <div className="billing-split">
            <section className="dash-panel" aria-labelledby="billing-price-title">
              <h2 id="billing-price-title" className="dash-panel__title">
                Custo da vida
              </h2>
              <p className="page-lead">
                Quanto a consultoria cobra <strong>por cada vida, por mes</strong>.
                100 vidas × R$ 1,20 = R$ 120,00.
              </p>
              <form className="stack-form" onSubmit={onSavePricing}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="unit-price">Custo por vida (R$)</label>
                    <input
                      id="unit-price"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      disabled={!canManage || saving}
                      inputMode="decimal"
                      placeholder="1,20"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="franchise">Franquia total (vidas)</label>
                    <input
                      id="franchise"
                      value={franchise}
                      onChange={(e) => setFranchise(e.target.value)}
                      disabled={!canManage || saving}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="trial-days">Dias de teste padrao</label>
                    <input
                      id="trial-days"
                      value={trialDays}
                      onChange={(e) => setTrialDays(e.target.value)}
                      disabled={!canManage || saving}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="trial-lives">Vidas no teste padrao</label>
                    <input
                      id="trial-lives"
                      value={trialLives}
                      onChange={(e) => setTrialLives(e.target.value)}
                      disabled={!canManage || saving}
                      inputMode="numeric"
                    />
                  </div>
                </div>
                {canManage ? (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? 'Salvando...' : 'Salvar preco e franquia'}
                  </button>
                ) : (
                  <p className="field-hint">Somente OWNER/ADMIN alteram precos.</p>
                )}
              </form>
            </section>

            <section
              className="dash-panel"
              aria-labelledby="billing-preview-title"
            >
              <h2 id="billing-preview-title" className="dash-panel__title">
                Simulador
              </h2>
              <p className="page-lead">
                Digite as vidas contratadas. A conta e sempre{' '}
                <strong>vidas × custo da vida</strong>.
              </p>
              <div className="field">
                <label htmlFor="preview-lives">Vidas contratadas</label>
                <input
                  id="preview-lives"
                  value={previewLives}
                  onChange={(e) => setPreviewLives(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              {previewQuote ? (
                <div className="billing-formula" aria-live="polite">
                  <p className="billing-formula__eq">
                    {previewQuote.lives.toLocaleString('pt-BR')} vidas ×{' '}
                    {formatBrlFromCents(previewQuote.unitPriceCents)} ={' '}
                    <strong>
                      {formatBrlFromCents(previewQuote.grossMonthlyCents)}
                    </strong>
                    <span> / mes</span>
                  </p>
                  {previewQuote.reducerPercent > 0 ? (
                    <p className="field-hint">
                      Redutor {previewQuote.reducerPercent}%
                      {previewQuote.reducerLabel
                        ? ` (${previewQuote.reducerLabel})`
                        : ''}
                      : tabela fica{' '}
                      {formatBrlFromCents(previewQuote.tableMonthlyCents)}
                    </p>
                  ) : (
                    <p className="field-hint">
                      Sem redutor neste volume — mensalidade = vidas × custo.
                    </p>
                  )}
                </div>
              ) : null}
            </section>
          </div>

          <section className="dash-panel" aria-labelledby="billing-reducers-title">
            <h2 id="billing-reducers-title" className="dash-panel__title">
              Redutores por volume
            </h2>
            <p className="page-lead">
              Quanto mais vidas, maior o desconto no unitario. Aplica-se o
              maior patamar que o cliente alcancar.
            </p>
            <form onSubmit={onSaveReducers}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">A partir de</th>
                      <th scope="col">Desconto</th>
                      <th scope="col">Rotulo</th>
                      {canManage ? <th scope="col"> </th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {reducers.map((row, index) => (
                      <tr key={`${row.minLives}-${index}`}>
                        <td>
                          <input
                            className="billing-inline-input"
                            value={row.minLives}
                            disabled={!canManage || saving}
                            onChange={(e) =>
                              setReducers((prev) =>
                                prev.map((item, i) =>
                                  i === index
                                    ? { ...item, minLives: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            aria-label="Vidas minimas"
                          />
                        </td>
                        <td>
                          <input
                            className="billing-inline-input"
                            value={row.percentOff}
                            disabled={!canManage || saving}
                            onChange={(e) =>
                              setReducers((prev) =>
                                prev.map((item, i) =>
                                  i === index
                                    ? { ...item, percentOff: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            aria-label="Percentual de desconto"
                          />
                          <span className="field-hint"> %</span>
                        </td>
                        <td>
                          <input
                            className="billing-inline-input billing-inline-input--wide"
                            value={row.label}
                            disabled={!canManage || saving}
                            onChange={(e) =>
                              setReducers((prev) =>
                                prev.map((item, i) =>
                                  i === index
                                    ? { ...item, label: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            aria-label="Rotulo do redutor"
                          />
                        </td>
                        {canManage ? (
                          <td>
                            <button
                              type="button"
                              className="btn btn-ghost btn-compact"
                              onClick={() =>
                                setReducers((prev) =>
                                  prev.filter((_, i) => i !== index),
                                )
                              }
                            >
                              Remover
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canManage ? (
                <div className="btn-row" style={{ marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      setReducers((prev) => [
                        ...prev,
                        { minLives: '', percentOff: '', label: '' },
                      ])
                    }
                  >
                    Novo patamar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    Salvar redutores
                  </button>
                </div>
              ) : null}
            </form>
            <ReducerPreview reducers={data.pricing.reducers} />
          </section>

          <section
            className="dash-panel"
            aria-labelledby="billing-entries-title"
          >
            <h2 id="billing-entries-title" className="dash-panel__title">
              Controle de entradas
            </h2>
            <div className="billing-filters" role="tablist" aria-label="Filtro">
              {(
                [
                  ['all', 'Todos'],
                  ['trial', 'Teste'],
                  ['active', 'Ativos'],
                  ['past_due', 'Atraso'],
                  ['suspended', 'Bloqueados'],
                  ['none', 'Sem plano'],
                ] as Array<[FilterId, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  className={`billing-filter${filter === id ? ' is-on' : ''}`}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="billing-entries">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Cliente</th>
                      <th scope="col">Plano</th>
                      <th scope="col">Vidas</th>
                      <th scope="col">Vidas × custo</th>
                      <th scope="col">Cobra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <p className="empty-state">Nenhum cliente neste filtro.</p>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((row) => {
                        const active = selectedId === row.clientId;
                        return (
                          <tr
                            key={row.clientId}
                            className={active ? 'billing-row--on' : undefined}
                          >
                            <td>
                              <button
                                type="button"
                                className="billing-client-btn"
                                onClick={() => setSelectedId(row.clientId)}
                              >
                                <strong>
                                  {row.tradeName || row.legalName}
                                </strong>
                                <span className="table-sub mono">
                                  {row.cnpj}
                                </span>
                              </button>
                            </td>
                            <td>
                              <span
                                className={pillClass(
                                  row.subscription?.status ?? null,
                                )}
                              >
                                {clientSubscriptionStatusLabel(
                                  row.subscription?.status,
                                )}
                              </span>
                            </td>
                            <td>
                              {row.usedLives}/{row.allocatedLives}
                            </td>
                            <td>
                              {row.allocatedLives} ×{' '}
                              {formatBrlFromCents(row.quote.unitPriceCents)}
                              <span className="table-sub">
                                {formatBrlFromCents(row.quote.grossMonthlyCents)}
                                {row.quote.reducerPercent > 0
                                  ? ` · redutor −${row.quote.reducerPercent}% → ${formatBrlFromCents(row.quote.tableMonthlyCents)}`
                                  : ''}
                              </span>
                            </td>
                            <td>
                              {formatBrlFromCents(row.quote.chargedMonthlyCents)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <ClientPlanPanel
                row={selected}
                canManage={canManage}
                saving={saving}
                defaultTrialDays={data.pricing.defaultTrialDays}
                defaultTrialLives={data.pricing.defaultTrialLives}
                available={data.quota.available}
                onStartTrial={(clientId, days, lives) =>
                  run(
                    () => startClientTrial(clientId, { days, lives }),
                    'Periodo de teste liberado. Cliente entra sem custo.',
                  )
                }
                onActivate={(clientId, lives) =>
                  run(
                    () => activateClientSubscription(clientId, { lives }),
                    'Assinatura ativa. Mensalidade pela tabela (ou ajuste).',
                  )
                }
                onGrant={(clientId, extra) =>
                  run(
                    () => grantClientLives(clientId, extra),
                    'Vidas adicionadas. Mensalidade de tabela recalculada.',
                  )
                }
                onMonthly={(clientId, cents) =>
                  run(
                    () => adjustClientMonthly(clientId, cents),
                    cents === null
                      ? 'Ajuste removido. Voltou o valor de tabela.'
                      : 'Mensalidade ajustada.',
                  )
                }
                onPastDue={(clientId) =>
                  run(
                    () => markClientPastDue(clientId),
                    'Marcado em atraso. Portal ainda aberto.',
                  )
                }
                onSuspend={(clientId) =>
                  run(
                    () => suspendClientSubscription(clientId, 'NON_PAYMENT'),
                    'Cliente bloqueado por falta de pagamento.',
                  )
                }
                onReactivate={(clientId, lives) =>
                  run(
                    () => reactivateClientSubscription(clientId, lives),
                    'Assinatura reativada e portal liberado.',
                  )
                }
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function ReducerPreview({ reducers }: { reducers: LifePriceReducer[] }) {
  if (reducers.length === 0) return null;
  return (
    <p className="field-hint" style={{ marginTop: '0.75rem' }}>
      Patamares: {reducers.map((item) => `${item.minLives}+ → ${item.percentOff}%`).join(' · ')}
    </p>
  );
}

function ClientPlanPanel({
  row,
  canManage,
  saving,
  defaultTrialDays,
  defaultTrialLives,
  available,
  onStartTrial,
  onActivate,
  onGrant,
  onMonthly,
  onPastDue,
  onSuspend,
  onReactivate,
}: {
  row: ClientSubscriptionRow | null;
  canManage: boolean;
  saving: boolean;
  defaultTrialDays: number;
  defaultTrialLives: number;
  available: number;
  onStartTrial: (id: string, days: number, lives: number) => void;
  onActivate: (id: string, lives: number) => void;
  onGrant: (id: string, extra: number) => void;
  onMonthly: (id: string, cents: number | null) => void;
  onPastDue: (id: string) => void;
  onSuspend: (id: string) => void;
  onReactivate: (id: string, lives?: number) => void;
}) {
  const [trialDays, setTrialDays] = useState(String(defaultTrialDays));
  const [trialLives, setTrialLives] = useState(String(defaultTrialLives));
  const [paidLives, setPaidLives] = useState('10');
  const [extraLives, setExtraLives] = useState('5');
  const [monthly, setMonthly] = useState('');

  useEffect(() => {
    if (!row) return;
    setPaidLives(String(Math.max(row.allocatedLives, 1)));
    setMonthly(
      row.quote.overrideCents !== null
        ? centsToReaisInput(row.quote.overrideCents)
        : centsToReaisInput(row.quote.tableMonthlyCents),
    );
    setTrialLives(String(defaultTrialLives));
    setTrialDays(String(defaultTrialDays));
  }, [row, defaultTrialDays, defaultTrialLives]);

  if (!row) {
    return (
      <aside className="billing-detail">
        <p className="empty-state">
          Selecione um cliente na lista para liberar teste, ceder vidas ou
          bloquear por falta de pagamento.
        </p>
      </aside>
    );
  }

  const status = row.subscription?.status ?? null;
  const isOpen = status === 'TRIAL' || status === 'ACTIVE' || status === 'PAST_DUE';

  return (
    <aside className="billing-detail" aria-label="Acoes do cliente">
      <p className="page-kicker">Cliente</p>
      <h3 className="settings-section__title">
        {row.tradeName || row.legalName}
      </h3>
      <p className="field-hint">
        {row.usedLives} vidas em uso · {row.allocatedLives} cedidas · {available}{' '}
        livres na franquia
      </p>
      <p>
        <span className={pillClass(status)}>
          {clientSubscriptionStatusLabel(status)}
        </span>
      </p>
      {row.subscription?.status === 'TRIAL' ? (
        <p className="field-hint">
          Teste ate {formatDate(row.subscription.trialEndsAt)} ·{' '}
          {row.subscription.trialLives} vidas · sem custo
        </p>
      ) : null}
      {row.subscription?.suspendReason === 'TRIAL_EXPIRED' ? (
        <p className="form-error">Periodo de teste encerrado.</p>
      ) : null}

      <p className="billing-formula__eq">
        {row.allocatedLives} × {formatBrlFromCents(row.quote.unitPriceCents)} ={' '}
        <strong>{formatBrlFromCents(row.quote.grossMonthlyCents)}</strong>
        <span> / mes</span>
      </p>
      {row.quote.reducerPercent > 0 ? (
        <p className="field-hint">
          Redutor {row.quote.reducerPercent}% → tabela{' '}
          {formatBrlFromCents(row.quote.tableMonthlyCents)}
        </p>
      ) : null}
      <p className="field-hint">
        Cobra agora: {formatBrlFromCents(row.quote.chargedMonthlyCents)}
        {row.quote.overrideCents !== null ? ' (ajuste manual)' : ''}
      </p>

      <Link className="btn btn-secondary btn-compact" href={`/clientes/${row.clientId}`}>
        Abrir workspace
      </Link>

      {canManage ? (
        <div className="billing-actions">
          {status !== 'ACTIVE' && status !== 'PAST_DUE' ? (
            <form
              className="billing-action"
              onSubmit={(e) => {
                e.preventDefault();
                onStartTrial(
                  row.clientId,
                  Number(trialDays) || defaultTrialDays,
                  Number(trialLives) || defaultTrialLives,
                );
              }}
            >
              <h4>Uso gratuito (teste)</h4>
              <p className="field-hint">
                Libera o portal sem mensalidade, com poucas vidas.
              </p>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="act-trial-days">Dias</label>
                  <input
                    id="act-trial-days"
                    value={trialDays}
                    onChange={(e) => setTrialDays(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="act-trial-lives">Vidas</label>
                  <input
                    id="act-trial-lives"
                    value={trialLives}
                    onChange={(e) => setTrialLives(e.target.value)}
                  />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                Liberar teste
              </button>
            </form>
          ) : null}

          <form
            className="billing-action"
            onSubmit={(e) => {
              e.preventDefault();
              onActivate(row.clientId, Number(paidLives) || 1);
            }}
          >
            <h4>Ativar pago</h4>
            <div className="field">
              <label htmlFor="act-paid-lives">Vidas contratadas</label>
              <input
                id="act-paid-lives"
                value={paidLives}
                onChange={(e) => setPaidLives(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {status === 'TRIAL' ? 'Converter teste em pago' : 'Ativar assinatura'}
            </button>
          </form>

          {isOpen ? (
            <>
              <form
                className="billing-action"
                onSubmit={(e) => {
                  e.preventDefault();
                  onGrant(row.clientId, Number(extraLives) || 1);
                }}
              >
                <h4>Ceder mais vidas</h4>
                <div className="field">
                  <label htmlFor="act-extra">Quantidade extra</label>
                  <input
                    id="act-extra"
                    value={extraLives}
                    onChange={(e) => setExtraLives(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-secondary"
                  type="submit"
                  disabled={saving}
                >
                  Ceder vidas
                </button>
              </form>

              {status !== 'TRIAL' ? (
                <form
                  className="billing-action"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const cents = reaisToCents(monthly);
                    if (cents === null) return;
                    onMonthly(row.clientId, cents);
                  }}
                >
                  <h4>Ajustar mensalidade</h4>
                  <p className="field-hint">
                    Aumente ou reduza o valor cobrado deste cliente. A tabela
                    continua visivel.
                  </p>
                  <div className="field">
                    <label htmlFor="act-monthly">Valor cobrado (R$)</label>
                    <input
                      id="act-monthly"
                      value={monthly}
                      onChange={(e) => setMonthly(e.target.value)}
                    />
                  </div>
                  <div className="btn-row">
                    <button
                      className="btn btn-secondary"
                      type="submit"
                      disabled={saving}
                    >
                      Aplicar valor
                    </button>
                    {row.quote.overrideCents !== null ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={saving}
                        onClick={() => onMonthly(row.clientId, null)}
                      >
                        Voltar a tabela
                      </button>
                    ) : null}
                  </div>
                </form>
              ) : null}

              {status !== 'PAST_DUE' ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() => onPastDue(row.clientId)}
                >
                  Marcar atraso
                </button>
              ) : null}

              <button
                type="button"
                className="btn btn-danger"
                disabled={saving}
                onClick={() => {
                  if (
                    window.confirm(
                      'Bloquear o portal deste cliente por falta de pagamento?',
                    )
                  ) {
                    onSuspend(row.clientId);
                  }
                }}
              >
                Inativar por falta de pagamento
              </button>
            </>
          ) : null}

          {status === 'SUSPENDED' ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={() => onReactivate(row.clientId)}
            >
              Reativar apos pagamento
            </button>
          ) : null}
        </div>
      ) : (
        <p className="field-hint">Somente OWNER/ADMIN executam estas acoes.</p>
      )}
    </aside>
  );
}
