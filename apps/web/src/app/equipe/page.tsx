'use client';

import type {
  MembershipRole,
  OrganizationMember,
  OrganizationMemberAccessResult,
} from '@gestao-epi/shared';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import {
  createOrganizationMember,
  formatTeamAccessCopy,
  listOrganizationMembers,
  membershipRoleLabel,
  removeOrganizationMember,
  resetOrganizationMemberPassword,
  transferOrganizationOwnership,
  updateOrganizationMemberRole,
} from '../../lib/organization';

export default function EquipePage() {
  return (
    <RequireAuth>
      {(user) => (
        <EquipeContent
          orgName={user.organization.name}
          currentUserId={user.id}
          currentRole={user.membershipRole}
        />
      )}
    </RequireAuth>
  );
}

function EquipeContent({
  orgName,
  currentUserId,
  currentRole,
}: {
  orgName: string;
  currentUserId: string;
  currentRole: MembershipRole;
}) {
  const canManage = currentRole === 'OWNER' || currentRole === 'ADMIN';
  const isOwner = currentRole === 'OWNER';

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [oneTimeAccess, setOneTimeAccess] =
    useState<OrganizationMemberAccessResult | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Exclude<MembershipRole, 'OWNER'>>('ADMIN');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listOrganizationMembers();
      setMembers(rows);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar equipe da consultoria.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const access = await createOrganizationMember({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        role,
      });
      setOneTimeAccess(access);
      setName('');
      setEmail('');
      setPhone('');
      setRole('ADMIN');
      setNotice(
        access.warning ||
          `${access.member.user.name} adicionado(a) como ${membershipRoleLabel(access.member.role)}.`,
      );
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao adicionar usuario.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onChangeRole(
    member: OrganizationMember,
    next: Exclude<MembershipRole, 'OWNER'>,
  ) {
    if (!canManage || member.role === 'OWNER') return;
    setSaving(true);
    setError(null);
    try {
      await updateOrganizationMemberRole(member.id, next);
      setNotice(`Papel de ${member.user.name} atualizado.`);
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao alterar papel.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onTransfer(member: OrganizationMember) {
    if (!isOwner) return;
    const ok = window.confirm(
      `Transferir o administrador geral para ${member.user.name} (${member.user.email})?\n\nVoce passara a ser Administrador. Faça logout e login de novo para atualizar o papel na sessao.`,
    );
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const rows = await transferOrganizationOwnership(member.id);
      setMembers(rows);
      setNotice(
        `Administrador geral transferido para ${member.user.name}. Faca logout/login.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao transferir administrador geral.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onResetPassword(member: OrganizationMember) {
    if (!canManage) return;
    const ok = window.confirm(
      `Gerar senha temporaria para ${member.user.email}?`,
    );
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const access = await resetOrganizationMemberPassword(member.id);
      setOneTimeAccess(access);
      setNotice(`Senha temporaria gerada para ${member.user.email}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao redefinir senha.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(member: OrganizationMember) {
    if (!canManage || member.role === 'OWNER') return;
    if (member.userId === currentUserId) return;
    const ok = window.confirm(
      `Remover o acesso de ${member.user.name} a esta consultoria?`,
    );
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await removeOrganizationMember(member.id);
      setNotice(`${member.user.name} removido(a) da equipe.`);
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao remover usuario.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyAccess() {
    if (!oneTimeAccess) return;
    const text = formatTeamAccessCopy(oneTimeAccess);
    try {
      await navigator.clipboard.writeText(text);
      setNotice('Dados de acesso copiados.');
    } catch {
      window.prompt('Copie os dados de acesso:', text);
    }
  }

  return (
    <div className="portal-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Consultoria / Gestao</p>
          <h1 className="page-title">Equipe</h1>
          <p className="page-lead">
            Usuarios que acessam a gestao de <strong>{orgName}</strong>. O
            administrador geral (OWNER) pode transferir o controle e adicionar
            administradores e membros.
          </p>
        </div>
      </header>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-success">{notice}</p> : null}

      {oneTimeAccess ? (
        <section
          className="dash-panel"
          style={{ marginBottom: '1.25rem' }}
          aria-label="Acesso temporario"
        >
          <h2 className="dash-panel__title">Acesso / convite</h2>
          <p className="page-lead">
            {oneTimeAccess.warning ||
              'Confira o status do envio. Se a senha aparecer, copie agora.'}
          </p>
          <dl className="access-credentials__list">
            <div>
              <dt>Link da gestao</dt>
              <dd className="mono">{oneTimeAccess.accessUrl}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd className="mono">{oneTimeAccess.member.user.email}</dd>
            </div>
            {oneTimeAccess.temporaryPassword ? (
              <div>
                <dt>Senha temporaria</dt>
                <dd className="mono">{oneTimeAccess.temporaryPassword}</dd>
              </div>
            ) : (
              <div>
                <dt>Senha</dt>
                <dd>Enviada por e-mail/WhatsApp (oculta na tela)</dd>
              </div>
            )}
            <div>
              <dt>Papel</dt>
              <dd>{membershipRoleLabel(oneTimeAccess.member.role)}</dd>
            </div>
            {oneTimeAccess.delivery ? (
              <>
                <div>
                  <dt>E-mail (envio)</dt>
                  <dd>
                    {oneTimeAccess.delivery.email}
                    {oneTimeAccess.delivery.emailError ? (
                      <span className="table-sub">
                        {oneTimeAccess.delivery.emailError}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>WhatsApp (envio)</dt>
                  <dd>
                    {oneTimeAccess.delivery.whatsapp}
                    {oneTimeAccess.delivery.whatsappError ||
                    oneTimeAccess.delivery.whatsappDetail ? (
                      <span className="table-sub" style={{ color: 'var(--danger, #b42318)' }}>
                        {oneTimeAccess.delivery.whatsappError ||
                          oneTimeAccess.delivery.whatsappDetail}
                      </span>
                    ) : null}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
          <div className="btn-row" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void copyAccess()}
            >
              Copiar dados
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOneTimeAccess(null)}
            >
              Fechar
            </button>
          </div>
        </section>
      ) : null}

      {canManage ? (
        <section
          className="dash-panel"
          style={{ marginBottom: '1.25rem' }}
          aria-labelledby="add-member-title"
        >
          <h2 id="add-member-title" className="dash-panel__title">
            Adicionar usuario
          </h2>
          <p className="page-lead">
            O convite sai por e-mail (e WhatsApp se informar telefone), com
            resposta para o contato de suporte em Configuracoes — igual ao
            portal do cliente. Com comunicacoes ligadas, a senha nao aparece
            na tela.
          </p>
          <form className="form-panel" onSubmit={onCreate}>
            <div className="field">
              <label htmlFor="team-name">Nome</label>
              <input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                placeholder="Nome completo"
              />
            </div>
            <div className="field">
              <label htmlFor="team-email">E-mail (login)</label>
              <input
                id="team-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="pessoa@empresa.com"
              />
            </div>
            <div className="field">
              <label htmlFor="team-phone">WhatsApp (opcional)</label>
              <input
                id="team-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex.: 11999998888"
              />
            </div>
            <div className="field">
              <label htmlFor="team-role">Papel</label>
              <select
                id="team-role"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as Exclude<MembershipRole, 'OWNER'>)
                }
              >
                <option value="ADMIN">Administrador</option>
                <option value="MEMBER">Membro</option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Adicionar e enviar acesso'}
            </button>
          </form>
        </section>
      ) : (
        <p className="field-hint">
          Voce e membro: pode ver a equipe, mas so OWNER/ADMIN gerenciam
          acessos.
        </p>
      )}

      <section className="dash-panel" aria-labelledby="team-list-title">
        <h2 id="team-list-title" className="dash-panel__title">
          Membros ({members.length})
        </h2>
        {loading ? (
          <p className="field-hint">Carregando...</p>
        ) : members.length === 0 ? (
          <p className="field-hint">Nenhum membro encontrado.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Papel</th>
                  <th scope="col">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelf = member.userId === currentUserId;
                  return (
                    <tr key={member.id}>
                      <td>
                        <strong>{member.user.name}</strong>
                        {isSelf ? (
                          <span className="table-sub">Voce</span>
                        ) : null}
                      </td>
                      <td className="mono">{member.user.email}</td>
                      <td>
                        {member.role === 'OWNER' ? (
                          membershipRoleLabel(member.role)
                        ) : canManage ? (
                          <select
                            value={member.role}
                            disabled={saving || isSelf}
                            onChange={(e) =>
                              void onChangeRole(
                                member,
                                e.target.value as Exclude<
                                  MembershipRole,
                                  'OWNER'
                                >,
                              )
                            }
                            aria-label={`Papel de ${member.user.name}`}
                          >
                            <option value="ADMIN">Administrador</option>
                            <option value="MEMBER">Membro</option>
                          </select>
                        ) : (
                          membershipRoleLabel(member.role)
                        )}
                      </td>
                      <td>
                        <div className="btn-row">
                          {canManage ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-compact"
                              disabled={saving}
                              onClick={() => void onResetPassword(member)}
                            >
                              Nova senha
                            </button>
                          ) : null}
                          {isOwner && member.role !== 'OWNER' ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-compact"
                              disabled={saving}
                              onClick={() => void onTransfer(member)}
                            >
                              Tornar admin geral
                            </button>
                          ) : null}
                          {canManage &&
                          member.role !== 'OWNER' &&
                          !isSelf ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-compact"
                              disabled={saving}
                              onClick={() => void onRemove(member)}
                            >
                              Remover
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
