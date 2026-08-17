'use client';

import type {
  ClientGroup,
  ClientInitialAccess,
  ClientUserRole,
  ServedClient,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ClientAccessCredentials } from '../../../components/ClientAccessCredentials';
import { RequireAuth } from '../../../components/RequireAuth';
import { PageHeader } from '../../../components/ui/PageHeader';
import {
  createClientGroup,
  deleteClientGroup,
  getClientGroup,
  grantClientGroupAccess,
  listClientGroups,
  setClientGroupClients,
} from '../../../lib/client-groups';
import { formatCnpj } from '../../../lib/cnpj';
import { clientUserRoleLabel, listServedClients } from '../../../lib/served-clients';

function clientLabel(client: { tradeName: string | null; legalName: string }) {
  return client.tradeName || client.legalName;
}

function GruposContent() {
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [clients, setClients] = useState<ServedClient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientGroup | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [accessName, setAccessName] = useState('');
  const [accessEmail, setAccessEmail] = useState('');
  const [accessPhone, setAccessPhone] = useState('');
  const [accessRole, setAccessRole] =
    useState<Exclude<ClientUserRole, 'WORKER'>>('CLIENT_MANAGER');
  const [accessClientIds, setAccessClientIds] = useState<string[]>([]);
  const [oneTimeAccess, setOneTimeAccess] =
    useState<ClientInitialAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupList, clientList] = await Promise.all([
        listClientGroups(),
        listServedClients(),
      ]);
      setGroups(groupList);
      setClients(clientList.filter((item) => item.status === 'ACTIVE'));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar os grupos.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    const row = await getClientGroup(id);
    setDetail(row);
    setMemberIds(row.clients.map((c) => c.id));
    setAccessClientIds(row.clients.map((c) => c.id));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Falha ao abrir o grupo.');
    });
  }, [selectedId, loadDetail]);

  const groupedElsewhere = useMemo(() => {
    const map = new Map<string, string>();
    for (const client of clients) {
      if (client.group && client.group.id !== selectedId) {
        map.set(client.id, client.group.name);
      }
    }
    return map;
  }, [clients, selectedId]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createClientGroup({
        name: name.trim(),
        notes: notes.trim() || undefined,
      });
      setName('');
      setNotes('');
      await load();
      setSelectedId(created.id);
      setNotice('Grupo criado. Agora marque os CNPJs.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar o grupo.');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveMembers() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const next = await setClientGroupClients(selectedId, memberIds);
      setDetail(next);
      await load();
      setNotice('CNPJs do grupo atualizados. PGR, estoque, custo e entrega continuam por CNPJ.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao salvar os CNPJs do grupo.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onGrantAccess(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    setOneTimeAccess(null);
    try {
      const result = await grantClientGroupAccess(selectedId, {
        name: accessName.trim(),
        email: accessEmail.trim(),
        phone: accessPhone.trim() || undefined,
        role: accessRole,
        servedClientIds: accessClientIds,
      });
      if (result.initialAccess) setOneTimeAccess(result.initialAccess);
      await loadDetail(selectedId);
      setNotice(
        result.invited
          ? `Acesso criado em ${result.created} CNPJ(s). Convite enviado.`
          : `Acesso atualizado: ${result.created} novo(s), ${result.alreadyHadAccess} ja tinham este CNPJ.`,
      );
      setAccessName('');
      setAccessEmail('');
      setAccessPhone('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao liberar o acesso.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteGroup() {
    if (!selectedId || !detail) return;
    const ok = window.confirm(
      `Remover o grupo "${detail.name}"? Os CNPJs continuam cadastrados.`,
    );
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await deleteClientGroup(selectedId);
      setSelectedId(null);
      await load();
      setNotice('Grupo removido. Os CNPJs foram mantidos.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover o grupo.');
    } finally {
      setSaving(false);
    }
  }

  function toggleId(
    list: string[],
    setter: (next: string[]) => void,
    id: string,
  ) {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  return (
    <div className="module-page">
      <PageHeader
        kicker="Clientes"
        title="Grupos empresariais"
        lead="Junte CNPJs do mesmo grupo (fazendas, holdings). PGR, estoque, custo e entrega continuam separados por empresa. O gestor do portal troca de CNPJ so nas empresas pelas quais e responsavel."
        actions={
          <Link className="btn btn-secondary" href="/clientes">
            Voltar aos clientes
          </Link>
        }
      />

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="form-success" role="status">
          {notice}
        </p>
      ) : null}

      {oneTimeAccess ? (
        <ClientAccessCredentials
          access={oneTimeAccess}
          title="Acesso do gestor no grupo"
          onDismiss={() => setOneTimeAccess(null)}
        />
      ) : null}

      <section className="surface" aria-labelledby="group-create-title">
        <h2 id="group-create-title" className="page-title page-title--sm">
          Novo grupo
        </h2>
        <form className="form" onSubmit={(e: FormEvent) => void onCreate(e)}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="group-name">Nome do grupo</label>
              <input
                id="group-name"
                required
                minLength={2}
                placeholder="Ex.: Grupo Polimental"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="group-notes">Observacao</label>
              <input
                id="group-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Criar grupo'}
          </button>
        </form>
      </section>

      <section className="surface" aria-labelledby="group-list-title">
        <h2 id="group-list-title" className="page-title page-title--sm">
          Grupos
        </h2>
        {loading ? (
          <p className="page-lead">Carregando...</p>
        ) : groups.length === 0 ? (
          <p className="page-lead">Nenhum grupo ainda.</p>
        ) : (
          <div className="stack-list" role="list">
            {groups.map((group) => (
              <article key={group.id} className="stack-card" role="listitem">
                <div className="stack-card__body">
                  <div className="stack-card__main">
                    <strong className="stack-card__title">{group.name}</strong>
                    <p className="stack-card__meta">
                      {group.clients.length} CNPJ(s)
                      {group.notes ? ` · ${group.notes}` : ''}
                    </p>
                  </div>
                  <div className="stack-card__actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setSelectedId(group.id)}
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {detail ? (
        <>
          <section className="surface" aria-labelledby="group-members-title">
            <div className="form-section-header">
              <div>
                <p className="page-kicker">{detail.name}</p>
                <h2 id="group-members-title" className="page-title page-title--sm">
                  CNPJs do grupo
                </h2>
                <p className="page-lead">
                  Marque as empresas. Cada uma mantem PGR, estoque, custo e
                  vidas proprios.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void onDeleteGroup()}
                disabled={saving}
              >
                Remover grupo
              </button>
            </div>
            {clients.length === 0 ? (
              <p className="page-lead">Cadastre clientes antes de montar o grupo.</p>
            ) : (
              <div className="stack-list">
                {clients.map((client) => {
                  const other = groupedElsewhere.get(client.id);
                  return (
                    <label key={client.id} className="catalog-search__check">
                      <input
                        type="checkbox"
                        checked={memberIds.includes(client.id)}
                        onChange={() =>
                          toggleId(memberIds, setMemberIds, client.id)
                        }
                      />
                      <span>
                        {clientLabel(client)} · {formatCnpj(client.cnpj)}
                        {other ? ` (hoje em ${other} — ao salvar, move para este grupo)` : ''}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="btn-row" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void onSaveMembers()}
                disabled={saving}
              >
                Salvar CNPJs
              </button>
            </div>
          </section>

          <section className="surface" aria-labelledby="group-access-title">
            <h2 id="group-access-title" className="page-title page-title--sm">
              Quem acessa no portal
            </h2>
            <p className="page-lead">
              O mesmo gestor pode ficar so com parte dos CNPJs. Ele troca de
              empresa no portal; entrega, estoque e custo abrem o CNPJ escolhido.
            </p>

            {(detail.people ?? []).length > 0 ? (
              <div className="stack-list" role="list">
                {(detail.people ?? []).map((person) => (
                  <article key={person.email} className="stack-card" role="listitem">
                    <div className="stack-card__body stack-card__body--stack">
                      <div className="stack-card__main">
                        <strong className="stack-card__title">{person.name}</strong>
                        <p className="stack-card__meta">
                          {person.email} · {clientUserRoleLabel(person.role)}
                        </p>
                        <p className="stack-card__meta">
                          {person.clients
                            .map((c) => clientLabel(c))
                            .join(' · ')}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="page-lead">Nenhum acesso liberado neste grupo.</p>
            )}

            <form className="form" onSubmit={(e: FormEvent) => void onGrantAccess(e)}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="access-name">Nome</label>
                  <input
                    id="access-name"
                    required
                    minLength={2}
                    value={accessName}
                    onChange={(e) => setAccessName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="access-email">E-mail</label>
                  <input
                    id="access-email"
                    type="email"
                    required
                    value={accessEmail}
                    onChange={(e) => setAccessEmail(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="access-phone">WhatsApp</label>
                  <input
                    id="access-phone"
                    value={accessPhone}
                    onChange={(e) => setAccessPhone(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="access-role">Papel</label>
                  <select
                    id="access-role"
                    value={accessRole}
                    onChange={(e) =>
                      setAccessRole(e.target.value as Exclude<ClientUserRole, 'WORKER'>)
                    }
                  >
                    <option value="CLIENT_MANAGER">Gestor</option>
                    <option value="STOCK_OPERATOR">Entregador / estoque</option>
                  </select>
                </div>
              </div>
              <p className="field-hint">CNPJs que esta pessoa pode operar</p>
              {detail.clients.length === 0 ? (
                <p className="page-lead">Salve os CNPJs do grupo antes.</p>
              ) : (
                detail.clients.map((client) => (
                  <label key={client.id} className="catalog-search__check">
                    <input
                      type="checkbox"
                      checked={accessClientIds.includes(client.id)}
                      onChange={() =>
                        toggleId(accessClientIds, setAccessClientIds, client.id)
                      }
                    />
                    <span>
                      {clientLabel(client)} · {formatCnpj(client.cnpj)}
                    </span>
                  </label>
                ))
              )}
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving || accessClientIds.length === 0}
              >
                Liberar acesso
              </button>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function ClientesGruposPage() {
  return (
    <RequireAuth>
      {() => <GruposContent />}
    </RequireAuth>
  );
}
