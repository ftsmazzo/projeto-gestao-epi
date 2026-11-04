'use client';

import { FormEvent, useState } from 'react';
import type { DistributorPartyFields, DistributorPartyInput } from '../../lib/distributor';
import {
  PartyFormFields,
  emptyPartyForm,
  partyFormToInput,
  type PartyFormState,
} from './PartyFormFields';

type Props = {
  kind: 'customer' | 'supplier';
  label: string;
  value: string;
  options: DistributorPartyFields[];
  onChange: (id: string) => void;
  onCreated: (party: DistributorPartyFields) => void;
  createParty: (input: DistributorPartyInput) => Promise<DistributorPartyFields>;
  required?: boolean;
  defaults?: Partial<PartyFormState>;
};

export function PartyPicker({
  kind,
  label,
  value,
  options,
  onChange,
  onCreated,
  createParty,
  required = true,
  defaults,
}: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PartyFormState>(() => emptyPartyForm(defaults));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const novoLabel = kind === 'customer' ? 'Novo cliente' : 'Novo fornecedor';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    setError(null);
    if (form.name.trim().length < 2) {
      setError('Informe o nome.');
      return;
    }
    setSaving(true);
    try {
      const created = await createParty(partyFormToInput(form));
      onCreated(created);
      onChange(created.id);
      setForm(emptyPartyForm());
      setOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao cadastrar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          style={{ flex: '1 1 220px' }}
        >
          <option value="">Selecione…</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
              {option.cnpj ? ` · ${option.cnpj}` : ''}
              {option.city ? ` · ${option.city}` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setError(null);
            setForm(emptyPartyForm(defaults));
            setOpen((current) => !current);
          }}
        >
          {open ? 'Fechar' : novoLabel}
        </button>
      </div>
      {!value && required ? (
        <p className="muted" style={{ marginTop: '0.35rem' }}>
          Selecione ou cadastre {kind === 'customer' ? 'o cliente' : 'o fornecedor'}.
        </p>
      ) : null}
      {open ? (
        <form
          className="dash-panel"
          style={{ marginTop: '0.75rem', padding: '0.75rem' }}
          onSubmit={onSubmit}
        >
          <h3 className="dash-panel__title" style={{ marginTop: 0 }}>
            {novoLabel}
          </h3>
          {error ? <p className="error">{error}</p> : null}
          <PartyFormFields value={form} onChange={setForm} compact />
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar e selecionar'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
