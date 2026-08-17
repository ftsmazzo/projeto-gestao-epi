'use client';

import type {
  OrganizationContact,
  OrganizationContactRole,
} from '@gestao-epi/shared';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  createOrganizationContact,
  deleteOrganizationContact,
  listOrganizationContacts,
  organizationContactRoleLabel,
  updateOrganizationContact,
} from '../../lib/organization';

type ContactForm = {
  name: string;
  email: string;
  phone: string;
  role: OrganizationContactRole;
  isPrimary: boolean;
  notes: string;
};

const emptyForm: ContactForm = {
  name: '',
  email: '',
  phone: '',
  role: 'SUPPORT',
  isPrimary: false,
  notes: '',
};

const ROLES: OrganizationContactRole[] = [
  'SUPPORT',
  'COMMERCIAL',
  'BILLING',
  'OPERATIONS',
];

export function ContatosSection() {
  const [contacts, setContacts] = useState<OrganizationContact[]>([]);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listOrganizationContacts();
      setContacts(rows);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar contatos da consultoria.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function startEdit(contact: OrganizationContact) {
    setEditingId(contact.id);
    setForm({
      name: contact.name,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      role: contact.role,
      isPrimary: contact.isPrimary,
      notes: contact.notes ?? '',
    });
    setNotice(null);
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        role: form.role,
        isPrimary: form.isPrimary,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        await updateOrganizationContact(editingId, payload);
        setNotice('Contato atualizado.');
      } else {
        await createOrganizationContact(payload);
        setNotice('Contato criado.');
      }
      resetForm();
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao salvar o contato.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm('Remover este contato da consultoria?')) return;
    setError(null);
    try {
      await deleteOrganizationContact(id);
      if (editingId === id) resetForm();
      await reload();
      setNotice('Contato removido.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao remover o contato.',
      );
    }
  }

  return (
    <div className="settings-section">
      <header className="settings-section__head">
        <h2 className="settings-section__title">Contatos da consultoria</h2>
        <p className="page-lead">
          Identidade nas mensagens aos clientes (e-mail e WhatsApp): suporte,
          comercial, cobranca e operacao. Marque um como primario para uso
          padrao. Depois da implantacao das vidas, o WhatsApp de Operacao (ou
          do contato primario) recebe aviso se a lista de RH tiver cargos que o
          PGR nao cobriu.
        </p>
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

      <section className="dash-panel" aria-labelledby="settings-contact-form">
        <h3 id="settings-contact-form" className="dash-panel__title">
          {editingId ? 'Editar contato' : 'Novo contato'}
        </h3>
        <form onSubmit={onSubmit} className="stack-form">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="org-contact-name">Nome</label>
              <input
                id="org-contact-name"
                required
                minLength={2}
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="org-contact-role">Papel</label>
              <select
                id="org-contact-role"
                value={form.role}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    role: e.target.value as OrganizationContactRole,
                  }))
                }
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {organizationContactRoleLabel(role)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="org-contact-email">E-mail</label>
              <input
                id="org-contact-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="org-contact-phone">WhatsApp / telefone</label>
              <input
                id="org-contact-phone"
                value={form.phone}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="org-contact-notes">Observacoes</label>
            <textarea
              id="org-contact-notes"
              rows={2}
              value={form.notes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </div>
          <label className="catalog-search__check">
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, isPrimary: e.target.checked }))
              }
            />
            Contato primario (padrao nas comunicacoes)
          </label>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Adicionar'}
            </button>
            {editingId ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
              >
                Cancelar edicao
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="dash-panel" aria-labelledby="settings-contact-list">
        <h3 id="settings-contact-list" className="dash-panel__title">
          Cadastrados
        </h3>
        {loading ? (
          <p className="field-hint">Carregando...</p>
        ) : contacts.length === 0 ? (
          <p className="empty-state">
            Nenhum contato ainda. Cadastre ao menos um de suporte para as
            notificacoes.
          </p>
        ) : (
          <ul className="settings-card-list">
            {contacts.map((contact) => (
              <li key={contact.id} className="settings-card">
                <div>
                  <p className="settings-card__title">{contact.name}</p>
                  <p className="settings-card__meta">
                    {organizationContactRoleLabel(contact.role)}
                    {contact.email ? ` · ${contact.email}` : ''}
                    {contact.phone ? ` · ${contact.phone}` : ''}
                  </p>
                </div>
                <div className="settings-card__flags">
                  {contact.isPrimary ? (
                    <span className="status-pill status-pill--info">
                      Primario
                    </span>
                  ) : null}
                  <span
                    className={`status-pill status-pill--${
                      contact.isActive ? 'active' : 'inactive'
                    }`}
                  >
                    {contact.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact"
                    onClick={() => startEdit(contact)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-compact"
                    onClick={() => void onDelete(contact.id)}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
