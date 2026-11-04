'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  PartyFormFields,
  emptyPartyForm,
  partyFormToInput,
  type PartyFormState,
} from '../../../components/distributor/PartyFormFields';
import {
  createSupplier,
  listSuppliers,
  updateSupplier,
  type DistributorSupplier,
} from '../../../lib/distributor';

function partyToForm(party: DistributorSupplier): PartyFormState {
  return {
    name: party.name,
    cnpj: party.cnpj ?? '',
    email: party.email ?? '',
    phone: party.phone ?? '',
    notes: party.notes ?? '',
    stateRegistration: party.stateRegistration ?? '',
    uf: party.uf ?? '',
    street: party.street ?? '',
    number: party.number ?? '',
    complement: party.complement ?? '',
    district: party.district ?? '',
    city: party.city ?? '',
    zipCode: party.zipCode ?? '',
    active: party.active,
  };
}

export default function DistribuidoraFornecedoresPage() {
  const [rows, setRows] = useState<DistributorSupplier[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<PartyFormState>(emptyPartyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload(q?: string) {
    const supplierRows = await listSuppliers(q, { includeInactive: true });
    setRows(supplierRows);
  }

  useEffect(() => {
    void reload().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
    );
  }, []);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await reload(search);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha na busca.');
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const input = partyFormToInput(form);
      if (editingId) {
        await updateSupplier(editingId, input);
        setNotice('Fornecedor atualizado.');
      } else {
        await createSupplier(input);
        setNotice('Fornecedor cadastrado.');
      }
      setForm(emptyPartyForm());
      setEditingId(null);
      await reload(search);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dash-page">
      <header className="dash-header">
        <div>
          <h1>Fornecedores</h1>
          <p className="muted">
            Cadastro usado em compras, contas a pagar e entrada de NF-e. Fiscal opcional.
          </p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      <form className="form dash-panel" onSubmit={onSearch}>
        <div className="field">
          <label htmlFor="busca-fornecedor">Buscar</label>
          <input
            id="busca-fornecedor"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, CNPJ ou cidade"
          />
        </div>
        <button className="btn" type="submit">
          Buscar
        </button>
      </form>

      <form className="form dash-panel" onSubmit={onSave}>
        <h2 className="dash-panel__title">
          {editingId ? 'Editar fornecedor' : 'Novo fornecedor'}
        </h2>
        <PartyFormFields value={form} onChange={setForm} showActive={Boolean(editingId)} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar'}
          </button>
          {editingId ? (
            <button
              className="btn"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyPartyForm());
              }}
            >
              Cancelar edição
            </button>
          ) : null}
        </div>
      </form>

      <section className="dash-panel">
        <h2 className="dash-panel__title">Lista</h2>
        <ul className="list">
          {rows.map((row) => (
            <li key={row.id}>
              <strong>{row.name}</strong>
              {!row.active ? ' · Inativo' : ''}
              {row.cnpj ? ` · ${row.cnpj}` : ''}
              {row.city ? ` · ${row.city}` : ''}
              {row.uf ? `/${row.uf}` : ''}
              <div style={{ marginTop: '0.35rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setEditingId(row.id);
                    setForm(partyToForm(row));
                    setNotice(null);
                    setError(null);
                  }}
                >
                  Editar
                </button>
              </div>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="muted">Nenhum fornecedor cadastrado.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
