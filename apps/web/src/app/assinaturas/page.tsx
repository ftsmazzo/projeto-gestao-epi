'use client';

import type {
  AuthUser,
  ClientSubscriptionRow,
  SubscriptionsOverview,
} from '@gestao-epi/shared';
import { formatBrlFromCents } from '@gestao-epi/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import {
  centsToReaisInput,
  getSubscriptionsOverview,
  reaisToCents,
  reactivateClientSubscription,
  suspendClientSubscription,
  updateLifePricing,
} from '../../lib/subscriptions';

type FilterId = 'all' | 'active' | 'inactive';

function isAdminRole(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

function isClientInactive(row: ClientSubscriptionRow) {
  return (
    row.clientStatus === 'INACTIVE' ||
    row.subscription?.status === 'SUSPENDED'
  );
}

function suggestedMonthlyCents(row: ClientSubscriptionRow, unitPriceCents: number) {
  return Math.max(0, Math.round(row.allocatedLives * unitPriceCents));
}

export default function AssinaturasPage() {
  return (
    <RequireAuth>
      {(user) => (
        <Suspense
          fallback={
            <p className="field-hint" role="status">
              Carregando acompanhamento...
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
  const [previewLives, setPreviewLives] = useState('50');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getSubscriptionsOverview();
      setData(next);
      setUnitPrice(centsToReaisInput(next.pricing.unitPriceCents));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar o acompanhamento.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unitCents =
    reaisToCents(unitPrice) ?? data?.pricing.unitPriceCents ?? 0;

  const selected = useMemo(
    () => data?.clients.find((row) => row.clientId === selectedId) ?? null,
    [data, selectedId],
  );

  const filtered = useMemo(() => {
    const rows = data?.clients ?? [];
    if (filter === 'active') return rows.filter((row) => !isClientInactive(row));
    if (filter === 'inactive') return rows.filter(isClientInactive);
    return rows;
  }, [data, filter]);

  const suggestedTotal = useMemo(() => {
    if (!data) return 0;
    return data.clients
      .filter((row) => !isClientInactive(row))
      .reduce(
        (sum, row) => sum + suggestedMonthlyCents(row, unitCents),
        0,
      );
  }, [data, unitCents]);

  const previewLivesN = Math.max(0, Number(previewLives) || 0);
  const previewMonthly = Math.round(previewLivesN * unitCents);

  const inactiveCount =
    data?.clients.filter(isClientInactive).length ?? 0;
  const activeCount = (data?.clients.length ?? 0) - inactiveCount;

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

  async function onSavePrice(event: FormEvent) {
    event.preventDefault();
    const cents = reaisToCents(unitPrice);
    if (cents === null) {
      setError('Informe um preco por vida valido (ex.: 1,20).');
      return;
    }
    await run(
      () => updateLifePricing({ unitPriceCents: cents }),
      'Preco por vida atualizado. Serve so como referencia de cobranca.',
    );
  }

  return (
    <div className="module-page billing-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Consultoria</p>
          <h1 className="page-title">Acompanhamento financeiro</h1>
          <p className="page-lead">
            Saldo de vidas da franquia, quanto cada cliente deveria pagar
            (vidas × preco) e um botao para inativar o portal se o pagamento
            atrasar. Nao e um sistema de assinatura com desconto.
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
          <section className="dash-kpi-grid" aria-label="Saldo da franquia">
            <article className="dash-kpi">
              <p className="dash-kpi__label">Franquia de vidas</p>
              <p className="dash-kpi__value">
                {data.quota.allocated}/{data.quota.contracted}
              </p>
              <p className="dash-kpi__hint">
                {data.quota.available} livres · {data.quota.used} em uso
              </p>
            </article>
            <article className="dash-kpi">
              <p className="dash-kpi__label">Receita sugerida</p>
              <p className="dash-kpi__value">
                {formatBrlFromCents(suggestedTotal)}
              </p>
              <p className="dash-kpi__hint">
                Soma dos clientes ativos · vidas × preco
              </p>
            </article>
            <article className="dash-kpi dash-kpi--ok">
              <p className="dash-kpi__label">Clientes ativos</p>
              <p className="dash-kpi__value">{activeCount}</p>
              <p className="dash-kpi__hint">Portal liberado</p>
            </article>
            <article
              className={`dash-kpi${inactiveCount > 0 ? ' dash-kpi--warn' : ''}`}
            >
              <p className="dash-kpi__label">Inativos</p>
              <p className="dash-kpi__value">{inactiveCount}</p>
              <p className="dash-kpi__hint">Portal bloqueado</p>
            </article>
          </section>

          <div className="billing-split">
            <section className="dash-panel" aria-labelledby="billing-price-title">
              <h2 id="billing-price-title" className="dash-panel__title">
                Preco por vida
              </h2>
              <p className="page-lead">
                Referencia para voce cobrar o CNPJ. A ProntEPI nao cobra esse
                valor — e a sua tabela.
              </p>
              <form className="stack-form" onSubmit={onSavePrice}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="unit-price">Preco por vida / mes (R$)</label>
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
                    <label htmlFor="franchise">Franquia ProntEPI</label>
                    <input
                      id="franchise"
                      value={`${data.quota.contracted} vidas`}
                      readOnly
                      disabled
                    />
                    <p className="field-hint">
                      Teto vendido pela ProntEPI. So o Painel SaaS altera.
                    </p>
                  </div>
                </div>
                {canManage ? (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? 'Salvando...' : 'Salvar preco de referencia'}
                  </button>
                ) : (
                  <p className="field-hint">
                    Somente OWNER/ADMIN alteram o preco de referencia.
                  </p>
                )}
              </form>
            </section>

            <section
              className="dash-panel"
              aria-labelledby="billing-preview-title"
            >
              <h2 id="billing-preview-title" className="dash-panel__title">
                Quanto cobrar
              </h2>
              <p className="page-lead">
                Conta simples: <strong>vidas × preco por vida</strong>.
              </p>
              <div className="field">
                <label htmlFor="preview-lives">Vidas do cliente</label>
                <input
                  id="preview-lives"
                  value={previewLives}
                  onChange={(e) => setPreviewLives(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="billing-formula" aria-live="polite">
                <p className="billing-formula__eq">
                  {previewLivesN.toLocaleString('pt-BR')} vidas ×{' '}
                  {formatBrlFromCents(unitCents)} ={' '}
                  <strong>{formatBrlFromCents(previewMonthly)}</strong>
                  <span> / mes</span>
                </p>
                <p className="field-hint">
                  Use para propor o valor. Sem desconto, trial ou override.
                </p>
              </div>
            </section>
          </div>

          <section className="dash-panel" aria-labelledby="billing-clients-title">
            <h2 id="billing-clients-title" className="dash-panel__title">
              Clientes
            </h2>
            <div className="billing-filters" role="tablist" aria-label="Filtro">
              {(
                [
                  ['all', 'Todos'],
                  ['active', 'Ativos'],
                  ['inactive', 'Inativos'],
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
                      <th scope="col">Situacao</th>
                      <th scope="col">Vidas</th>
                      <th scope="col">Valor sugerido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={4}>
                          <p className="empty-state">
                            Nenhum cliente neste filtro.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((row) => {
                        const inactive = isClientInactive(row);
                        const suggested = suggestedMonthlyCents(row, unitCents);
                        return (
                          <tr
                            key={row.clientId}
                            className={
                              selectedId === row.clientId
                                ? 'billing-row--on'
                                : undefined
                            }
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
                                className={
                                  inactive
                                    ? 'status-pill status-pill--critical'
                                    : 'status-pill status-pill--active'
                                }
                              >
                                {inactive ? 'Inativo' : 'Ativo'}
                              </span>
                            </td>
                            <td>
                              {row.usedLives}/{row.allocatedLives}
                            </td>
                            <td>
                              {inactive ? (
                                '—'
                              ) : (
                                <>
                                  {row.allocatedLives} ×{' '}
                                  {formatBrlFromCents(unitCents)}
                                  <span className="table-sub">
                                    {formatBrlFromCents(suggested)} / mes
                                  </span>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <ClientMonitorPanel
                row={selected}
                unitCents={unitCents}
                canManage={canManage}
                saving={saving}
                available={data.quota.available}
                onSuspend={(clientId) =>
                  run(
                    () =>
                      suspendClientSubscription(clientId, 'NON_PAYMENT'),
                    'Cliente inativado. Portal bloqueado e vidas liberadas na franquia.',
                  )
                }
                onReactivate={(clientId) =>
                  run(
                    () => reactivateClientSubscription(clientId),
                    'Cliente reativado. Portal liberado.',
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

function ClientMonitorPanel({
  row,
  unitCents,
  canManage,
  saving,
  available,
  onSuspend,
  onReactivate,
}: {
  row: ClientSubscriptionRow | null;
  unitCents: number;
  canManage: boolean;
  saving: boolean;
  available: number;
  onSuspend: (id: string) => void;
  onReactivate: (id: string) => void;
}) {
  if (!row) {
    return (
      <aside className="billing-detail">
        <p className="empty-state">
          Selecione um cliente para ver o valor sugerido e inativar o portal
          por falta de pagamento.
        </p>
      </aside>
    );
  }

  const inactive = isClientInactive(row);
  const suggested = suggestedMonthlyCents(row, unitCents);

  return (
    <aside className="billing-detail" aria-label="Cliente">
      <p className="page-kicker">Cliente</p>
      <h3 className="settings-section__title">
        {row.tradeName || row.legalName}
      </h3>
      <p className="field-hint mono">{row.cnpj}</p>
      <p>
        <span
          className={
            inactive
              ? 'status-pill status-pill--critical'
              : 'status-pill status-pill--active'
          }
        >
          {inactive ? 'Inativo' : 'Ativo'}
        </span>
      </p>
      <p className="field-hint">
        {row.usedLives} em uso · {row.allocatedLives} alocadas · {available}{' '}
        livres na franquia
      </p>
      <p className="billing-formula__eq">
        {row.allocatedLives} × {formatBrlFromCents(unitCents)} ={' '}
        <strong>{formatBrlFromCents(suggested)}</strong>
        <span> / mes</span>
      </p>
      <p className="field-hint">Valor sugerido. Nao e cobranca automatica.</p>

      <Link
        className="btn btn-secondary btn-compact"
        href={`/clientes/${row.clientId}`}
      >
        Abrir workspace
      </Link>

      {canManage ? (
        <div className="billing-actions">
          {!inactive ? (
            <button
              type="button"
              className="btn btn-danger"
              disabled={saving}
              onClick={() => {
                if (
                  window.confirm(
                    'Inativar este cliente por falta de pagamento? O portal para e as vidas voltam para a franquia.',
                  )
                ) {
                  onSuspend(row.clientId);
                }
              }}
            >
              Inativar por falta de pagamento
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={() => onReactivate(row.clientId)}
            >
              Reativar
            </button>
          )}
        </div>
      ) : (
        <p className="field-hint">Somente OWNER/ADMIN inativam a conta.</p>
      )}
    </aside>
  );
}
