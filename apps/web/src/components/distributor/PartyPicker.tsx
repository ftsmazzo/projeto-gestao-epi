'use client';

import { FormEvent, useEffect, useState } from 'react';
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
  /** Abre o formulário de cadastro já expandido (ex.: emitente da NF-e sem match). */
  autoOpen?: boolean;
  /** Formulário completo com endereço + ViaCEP (não só cidade/UF). */
  fullForm?: boolean;
  title?: string;
  submitLabel?: string;
  hint?: string | null;
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
  autoOpen = false,
  fullForm = false,
  title,
  submitLabel,
  hint,
}: Props) {
  const [open, setOpen] = useState(autoOpen);
  const [form, setForm] = useState<PartyFormState>(() => emptyPartyForm(defaults));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoOpen) return;
    setOpen(true);
    setForm(emptyPartyForm(defaults));
    setError(null);
    // defaults mudam quando a nota é lida; reabre com dados do emitente
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a autoOpen + CNPJ/nome
  }, [autoOpen, defaults?.cnpj, defaults?.name]);

  const novoLabel = kind === 'customer' ? 'Novo cliente' : 'Novo fornecedor';
  const panelTitle = title ?? novoLabel;
  const saveLabel = submitLabel ?? 'Salvar e selecionar';

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
          required={required && !autoOpen}
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
      {hint ? (
        <p className="field-hint" style={{ marginTop: '0.35rem' }}>
          {hint}
        </p>
      ) : !value && required ? (
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
            {panelTitle}
          </h3>
          {error ? <p className="error">{error}</p> : null}
          <PartyFormFields value={form} onChange={setForm} compact={!fullForm} />
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando…' : saveLabel}
          </button>
        </form>
      ) : null}
    </div>
  );
}
