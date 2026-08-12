'use client';

import type {
  CreatePlatformTenantResult,
  PlatformOverview,
  PlatformTenantRow,
} from '@gestao-epi/shared';
import { formatBrlFromCents } from '@gestao-epi/shared';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { RequirePlatformAuth } from '../../components/RequirePlatformAuth';
import {
  activatePlatformTenant,
  createPlatformTenant,
  destroyPlatformTenant,
  getPlatformOverview,
  grantPlatformLives,
  resendPlatformAccess,
  suspendPlatformTenant,
  updatePlatformTenant,
} from '../../lib/platform';
import { centsToReaisInput, reaisToCents } from '../../lib/subscriptions';

function statusLabel(status: PlatformTenantRow['status']) {
  return status === 'ACTIVE' ? 'Ativa' : 'Suspensa';
}

function inviteLabel(status: string | null | undefined) {
  if (status === 'SENT') return 'Enviado';
  if (status === 'FAILED') return 'Falhou';
  if (status === 'SKIPPED') return 'Nao enviado';
  if (status === 'PENDING') return 'Pendente';
  return '—';
}

export default function PlataformaPage() {
  return (
    <RequirePlatformAuth>
      {(user) => <PlataformaContent userName={user.name} />}
    </RequirePlatformAuth>
  );
}

function PlataformaContent({ userName }: { userName: string }) {
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createdAccess, setCreatedAccess] =
    useState<CreatePlatformTenantResult['owner'] | null>(null);

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [quota, setQuota] = useState('1000');
  const [wholesale, setWholesale] = useState('0,00');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuota, setEditQuota] = useState('');
  const [editWholesale, setEditWholesale] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [destroyId, setDestroyId] = useState<string | null>(null);
  const [destroyName, setDestroyName] = useState('');

  const reload = useCallback(async () => {
    const overview = await getPlatformOverview();
    setData(overview);
  }, []);

  useEffect(() => {
    void reload()
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Nao foi possivel carregar as consultorias.',
        );
      })
      .finally(() => setLoading(false));
  }, [reload]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setCreatedAccess(null);
    const lives = Number(quota);
    const cents = reaisToCents(wholesale);
    if (!Number.isInteger(lives) || lives < 0) {
      setError('Informe a franquia de vidas.');
      return;
    }
    if (cents == null) {
      setError('Informe o preco de atacado por vida.');
      return;
    }
    setSaving(true);
    try {
      const result = await createPlatformTenant({
        name,
        ownerName,
        ownerEmail,
        ownerPhone,
        contractedLifeQuota: lives,
        wholesaleUnitPriceCents: cents,
      });
      setCreatedAccess(result.owner);
      setSuccess(`Consultoria ${result.tenant.name} criada.`);
      setName('');
      setOwnerName('');
      setOwnerEmail('');
      setOwnerPhone('');
      setQuota('1000');
      setWholesale('0,00');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar consultoria.');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveEdit(tenant: PlatformTenantRow) {
    const lives = Number(editQuota);
    const cents = reaisToCents(editWholesale);
    if (!Number.isInteger(lives) || lives < 0 || cents == null) {
      setError('Informe franquia e preco de atacado validos.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updatePlatformTenant(tenant.id, {
        contractedLifeQuota: lives,
        wholesaleUnitPriceCents: cents,
        ...(editPhone.trim() ? { ownerPhone: editPhone.trim() } : {}),
      });
      setSuccess(`Contrato de ${tenant.name} atualizado.`);
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar.');
    } finally {
      setSaving(false);
    }
  }

  async function onGrant(tenant: PlatformTenantRow, extra: number) {
    const lives = extra;
    if (!Number.isInteger(lives) || lives < 1) {
      setError('Informe quantas vidas somar.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await grantPlatformLives(tenant.id, lives);
      setSuccess(`${lives} vidas adicionadas em ${tenant.name}.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aumentar vidas.');
    } finally {
      setSaving(false);
    }
  }

  async function onResend(tenant: PlatformTenantRow) {
    setSaving(true);
    setError(null);
    try {
      const result = await resendPlatformAccess(tenant.id);
      setCreatedAccess(result.owner);
      setSuccess(`Convite reenviado para ${tenant.name}.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao reenviar.');
    } finally {
      setSaving(false);
    }
  }

  async function onDestroy(tenant: PlatformTenantRow) {
    if (destroyName.trim().toLowerCase() !== tenant.name.trim().toLowerCase()) {
      setError(`Digite ${tenant.name} para confirmar a exclusao.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await destroyPlatformTenant(tenant.id, destroyName);
      setSuccess(`${tenant.name} foi zerada e removida.`);
      setDestroyId(null);
      setDestroyName('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao zerar.');
    } finally {
      setSaving(false);
    }
  }

  async function onToggleStatus(tenant: PlatformTenantRow) {
    setSaving(true);
    setError(null);
    try {
      if (tenant.status === 'ACTIVE') {
        await suspendPlatformTenant(tenant.id, suspendReason);
        setSuccess(`${tenant.name} suspensa.`);
      } else {
        await activatePlatformTenant(tenant.id);
        setSuccess(`${tenant.name} reativada.`);
      }
      setSuspendReason('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao alterar status.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">ProntEPI · SaaS</p>
          <h1 className="page-title">Gestao das consultorias</h1>
          <p className="page-lead">
            Ola, {userName}. Franquia, atacado, ocupacao e convite (e-mail e
            WhatsApp da ProntEPI). A consultoria so reparte as vidas que
            receber daqui.
          </p>
        </div>
      </header>

      {loading ? <p className="field-hint">Carregando contratos...</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="field-hint" role="status">
          {success}
        </p>
      ) : null}

      {data ? (
        <section className="dash-kpi-grid" aria-label="Resumo da plataforma">
          <article className="dash-kpi">
            <p className="dash-kpi__label">Consultorias ativas</p>
            <p className="dash-kpi__value">{data.tenants.active}</p>
            <p className="dash-kpi__hint">
              {data.tenants.suspended} suspensa(s) · {data.tenants.nearLimit} no
              limite
            </p>
          </article>
          <article className="dash-kpi">
            <p className="dash-kpi__label">Vidas da franquia</p>
            <p className="dash-kpi__value">
              {data.lives.allocated}/{data.lives.contracted}
            </p>
            <p className="dash-kpi__hint">
              {data.lives.used} em uso · {data.lives.occupancyPercent}% ocupado
            </p>
          </article>
          <article className="dash-kpi dash-kpi--ok">
            <p className="dash-kpi__label">Mensalidade de atacado</p>
            <p className="dash-kpi__value">
              {formatBrlFromCents(data.wholesaleMonthlyCents)}
            </p>
            <p className="dash-kpi__hint">Franquia × preco (ativas)</p>
          </article>
        </section>
      ) : null}

      <div className="saas-layout">
        <section className="dash-panel" aria-labelledby="lista-consultorias">
          <h2 id="lista-consultorias" className="dash-panel__title">
            Assinaturas
          </h2>
          {data && data.rows.length === 0 ? (
            <p className="field-hint">
              Nenhuma consultoria ainda. Cadastre a primeira ao lado.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Consultoria</th>
                    <th scope="col">Vidas</th>
                    <th scope="col">Contrato</th>
                    <th scope="col">Convite</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {data?.rows.map((tenant) => {
                    const editing = editingId === tenant.id;
                    const barClass =
                      tenant.occupancyPercent >= 95
                        ? 'is-full'
                        : tenant.occupancyPercent >= 80
                          ? 'is-warn'
                          : '';
                    return (
                      <tr key={tenant.id}>
                        <td>
                          <strong>{tenant.name}</strong>
                          <span className="table-sub">
                            {tenant.owner
                              ? `${tenant.owner.name} · ${tenant.owner.email}`
                              : 'sem dono'}
                            {tenant.owner?.phone
                              ? ` · ${tenant.owner.phone}`
                              : ''}
                            {tenant.activeClients
                              ? ` · ${tenant.activeClients} cliente(s)`
                              : ''}
                          </span>
                          <span
                            className={`status-pill ${
                              tenant.status === 'ACTIVE'
                                ? 'status-pill--active'
                                : 'status-pill--critical'
                            }`}
                          >
                            {statusLabel(tenant.status)}
                          </span>
                        </td>
                        <td>
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              value={editQuota}
                              onChange={(e) => setEditQuota(e.target.value)}
                              aria-label="Franquia"
                            />
                          ) : (
                            <>
                              {tenant.allocatedLives}/{tenant.contractedLifeQuota}
                              <span className="table-sub">
                                {tenant.availableLives} livres · {tenant.usedLives}{' '}
                                usadas
                              </span>
                              <span className="life-bar" aria-hidden="true">
                                <span
                                  className={`life-bar__fill ${barClass}`}
                                  style={{
                                    width: `${Math.min(100, tenant.occupancyPercent)}%`,
                                  }}
                                />
                              </span>
                            </>
                          )}
                        </td>
                        <td>
                          {editing ? (
                            <>
                              <input
                                inputMode="decimal"
                                value={editWholesale}
                                onChange={(e) => setEditWholesale(e.target.value)}
                                aria-label="Preco de atacado"
                              />
                              <input
                                value={editPhone}
                                onChange={(e) => setEditPhone(e.target.value)}
                                placeholder="WhatsApp DDD"
                                aria-label="WhatsApp do gestor"
                              />
                            </>
                          ) : (
                            <>
                              {formatBrlFromCents(tenant.wholesaleUnitPriceCents)}
                              /vida
                              <span className="table-sub">
                                {formatBrlFromCents(tenant.wholesaleMonthlyCents)}{' '}
                                / mes
                              </span>
                            </>
                          )}
                        </td>
                        <td>
                          <span className="table-sub">
                            E-mail: {inviteLabel(tenant.invite?.email)}
                            {tenant.invite?.emailError
                              ? ` (${tenant.invite.emailError})`
                              : ''}
                          </span>
                          <span className="table-sub">
                            WhatsApp: {inviteLabel(tenant.invite?.whatsapp)}
                            {tenant.invite?.whatsappError
                              ? ` (${tenant.invite.whatsappError})`
                              : ''}
                          </span>
                        </td>
                        <td>
                          <div className="btn-row">
                            {editing ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-compact"
                                  disabled={saving}
                                  onClick={() => void onSaveEdit(tenant)}
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-compact"
                                  onClick={() => setEditingId(null)}
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-compact"
                                  disabled={saving}
                                  onClick={() => void onGrant(tenant, 100)}
                                >
                                  +100 vidas
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-compact"
                                  disabled={saving}
                                  onClick={() => void onGrant(tenant, 500)}
                                >
                                  +500
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-compact"
                                  onClick={() => {
                                    setEditingId(tenant.id);
                                    setEditQuota(
                                      String(tenant.contractedLifeQuota),
                                    );
                                    setEditWholesale(
                                      centsToReaisInput(
                                        tenant.wholesaleUnitPriceCents,
                                      ),
                                    );
                                    setEditPhone(tenant.owner?.phone ?? '');
                                  }}
                                >
                                  Contrato
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-compact"
                                  disabled={saving}
                                  onClick={() => void onResend(tenant)}
                                >
                                  Reenviar acesso
                                </button>
                              </>
                            )}
                            {tenant.status === 'ACTIVE' ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-compact"
                                disabled={saving}
                                onClick={() => void onToggleStatus(tenant)}
                              >
                                Suspender
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary btn-compact"
                                disabled={saving}
                                onClick={() => void onToggleStatus(tenant)}
                              >
                                Reativar
                              </button>
                            )}
                            {destroyId === tenant.id ? (
                              <>
                                <input
                                  value={destroyName}
                                  onChange={(e) =>
                                    setDestroyName(e.target.value)
                                  }
                                  placeholder={`Digite ${tenant.name}`}
                                  aria-label="Confirmar nome para zerar"
                                />
                                <button
                                  type="button"
                                  className="btn btn-danger btn-compact"
                                  disabled={saving}
                                  onClick={() => void onDestroy(tenant)}
                                >
                                  Confirmar zerar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-compact"
                                  onClick={() => {
                                    setDestroyId(null);
                                    setDestroyName('');
                                  }}
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-ghost btn-compact"
                                disabled={saving}
                                onClick={() => {
                                  setDestroyId(tenant.id);
                                  setDestroyName('');
                                }}
                              >
                                Zerar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="saas-toolbar">
            <div className="field">
              <label htmlFor="suspend-reason">Motivo da suspensao</label>
              <input
                id="suspend-reason"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Inadimplencia do contrato SaaS"
              />
            </div>
          </div>
        </section>

        <section className="dash-panel" aria-labelledby="nova-consultoria">
          <h2 id="nova-consultoria" className="dash-panel__title">
            Nova consultoria
          </h2>
          <p className="page-lead">
            A ProntEPI envia e-mail e WhatsApp com o acesso. Sem telefone o
            Zap nao sai.
          </p>
          <form className="form" onSubmit={onCreate}>
            <div className="field">
              <label htmlFor="tenant-name">Nome da consultoria</label>
              <input
                id="tenant-name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Inseg"
              />
            </div>
            <div className="field">
              <label htmlFor="tenant-owner">Gestor (dono)</label>
              <input
                id="tenant-owner"
                required
                minLength={2}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="tenant-email">E-mail</label>
              <input
                id="tenant-email"
                type="email"
                required
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="tenant-phone">WhatsApp (DDD + numero)</label>
              <input
                id="tenant-phone"
                required
                minLength={10}
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="11999999999"
              />
            </div>
            <div className="field">
              <label htmlFor="tenant-quota">Franquia de vidas</label>
              <input
                id="tenant-quota"
                type="number"
                min={0}
                required
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="tenant-wholesale">Atacado por vida (R$)</label>
              <input
                id="tenant-wholesale"
                inputMode="decimal"
                required
                value={wholesale}
                onChange={(e) => setWholesale(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Criando...' : 'Criar e enviar acesso'}
            </button>
          </form>
          {createdAccess ? (
            <div className="field-hint" role="status">
              <p>
                Acesso: {createdAccess.accessUrl}
                {createdAccess.temporaryPassword
                  ? ` · Senha: ${createdAccess.temporaryPassword}`
                  : ''}
              </p>
              <p>
                E-mail: {inviteLabel(createdAccess.emailStatus)}
                {createdAccess.emailError
                  ? ` — ${createdAccess.emailError}`
                  : ''}
              </p>
              <p>
                WhatsApp: {inviteLabel(createdAccess.whatsappStatus)}
                {createdAccess.whatsappError
                  ? ` — ${createdAccess.whatsappError}`
                  : ''}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
