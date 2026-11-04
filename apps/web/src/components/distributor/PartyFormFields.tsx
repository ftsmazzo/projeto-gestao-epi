'use client';

import { useState } from 'react';
import { formatCnpjInput, isValidCnpj, normalizeCnpj } from '../../lib/cnpj';
import {
  lookupAddressByCep,
  lookupPartyByCnpj,
  type DistributorPartyInput,
} from '../../lib/distributor';

export const UF_OPTIONS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const;

export type PartyFormState = {
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  notes: string;
  stateRegistration: string;
  uf: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  zipCode: string;
  active: boolean;
};

export function emptyPartyForm(overrides?: Partial<PartyFormState>): PartyFormState {
  return {
    name: '',
    cnpj: '',
    email: '',
    phone: '',
    notes: '',
    stateRegistration: '',
    uf: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    zipCode: '',
    active: true,
    ...overrides,
  };
}

export function partyFormToInput(form: PartyFormState): DistributorPartyInput {
  return {
    name: form.name.trim(),
    cnpj: form.cnpj.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    notes: form.notes.trim() || null,
    stateRegistration: form.stateRegistration.trim() || null,
    uf: form.uf.trim() || null,
    street: form.street.trim() || null,
    number: form.number.trim() || null,
    complement: form.complement.trim() || null,
    district: form.district.trim() || null,
    city: form.city.trim() || null,
    zipCode: form.zipCode.trim() || null,
    active: form.active,
  };
}

type Props = {
  value: PartyFormState;
  onChange: (next: PartyFormState) => void;
  compact?: boolean;
  showActive?: boolean;
};

export function PartyFormFields({
  value,
  onChange,
  compact = false,
  showActive = false,
}: Props) {
  const [lookupBusy, setLookupBusy] = useState<'cnpj' | 'cep' | null>(null);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  function set<K extends keyof PartyFormState>(key: K, next: PartyFormState[K]) {
    onChange({ ...value, [key]: next });
  }

  async function onLookupCnpj() {
    setLookupError(null);
    setLookupMsg(null);
    const digits = normalizeCnpj(value.cnpj);
    if (!isValidCnpj(digits)) {
      setLookupError('Informe um CNPJ válido para buscar.');
      return;
    }
    setLookupBusy('cnpj');
    try {
      const lead = await lookupPartyByCnpj(digits);
      onChange({
        ...value,
        name: lead.name || value.name,
        cnpj: formatCnpjInput(lead.cnpj),
        email: lead.email ?? value.email,
        phone: lead.phone ?? value.phone,
        uf: lead.uf ?? value.uf,
        street: lead.street ?? value.street,
        number: lead.number ?? value.number,
        complement: lead.complement ?? value.complement,
        district: lead.district ?? value.district,
        city: lead.city ?? value.city,
        zipCode: lead.zipCode ?? value.zipCode,
      });
      const hint = [
        lead.situation ? `Situação: ${lead.situation}` : null,
        lead.tradeName ? `Fantasia: ${lead.tradeName}` : null,
        'IE continua manual (não vem da Receita).',
      ]
        .filter(Boolean)
        .join(' · ');
      setLookupMsg(hint);
    } catch (err: unknown) {
      setLookupError(err instanceof Error ? err.message : 'Falha ao consultar CNPJ.');
    } finally {
      setLookupBusy(null);
    }
  }

  async function onLookupCep() {
    setLookupError(null);
    setLookupMsg(null);
    const cep = value.zipCode.replace(/\D/g, '');
    if (cep.length !== 8) {
      setLookupError('Informe um CEP com 8 dígitos.');
      return;
    }
    setLookupBusy('cep');
    try {
      const address = await lookupAddressByCep(cep);
      onChange({
        ...value,
        zipCode: address.cep?.replace(/\D/g, '') || cep,
        street: address.logradouro || value.street,
        complement: address.complemento || value.complement,
        district: address.bairro || value.district,
        city: address.localidade || value.city,
        uf: address.uf || value.uf,
      });
      setLookupMsg('Endereço preenchido pelo ViaCEP.');
    } catch (err: unknown) {
      setLookupError(err instanceof Error ? err.message : 'Falha ao consultar CEP.');
    } finally {
      setLookupBusy(null);
    }
  }

  return (
    <div className="party-form">
      <fieldset className="product-form__section">
        <legend className="product-form__legend">Identificação</legend>
        <div className="form-grid">
          <div className="field field--span-2">
            <label>Nome *</label>
            <input
              value={value.name}
              onChange={(event) => set('name', event.target.value)}
              required
              minLength={2}
            />
          </div>
          <div className="field field--span-2">
            <label>CNPJ</label>
            <div className="product-form__inline">
              <input
                value={value.cnpj}
                onChange={(event) => set('cnpj', formatCnpjInput(event.target.value))}
                placeholder="00.000.000/0000-00"
              />
              <button
                type="button"
                className="btn"
                disabled={lookupBusy !== null}
                onClick={() => void onLookupCnpj()}
              >
                {lookupBusy === 'cnpj' ? 'Buscando…' : 'Buscar CNPJ'}
              </button>
            </div>
          </div>
          <div className="field">
            <label>Telefone</label>
            <input
              value={value.phone}
              onChange={(event) => set('phone', event.target.value)}
            />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input
              type="email"
              value={value.email}
              onChange={(event) => set('email', event.target.value)}
            />
          </div>
          {(lookupMsg || lookupError) && (
            <div className="cnpj-lookup-slot field--span-2">
              {lookupError ? <p className="error">{lookupError}</p> : null}
              {lookupMsg ? <p className="muted">{lookupMsg}</p> : null}
            </div>
          )}
          {showActive ? (
            <label className="field product-form__check field--span-2">
              <input
                type="checkbox"
                checked={value.active}
                onChange={(event) => set('active', event.target.checked)}
              />
              Ativo
            </label>
          ) : null}
        </div>
      </fieldset>

      {!compact ? (
        <>
          <fieldset className="product-form__section">
            <legend className="product-form__legend">Endereço fiscal</legend>
            <div className="form-grid">
              <div className="field">
                <label>IE</label>
                <input
                  value={value.stateRegistration}
                  onChange={(event) => set('stateRegistration', event.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="field">
                <label>UF</label>
                <select
                  value={value.uf}
                  onChange={(event) => set('uf', event.target.value)}
                >
                  <option value="">—</option>
                  {UF_OPTIONS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field field--span-2">
                <label>CEP</label>
                <div className="product-form__inline">
                  <input
                    value={value.zipCode}
                    onChange={(event) => set('zipCode', event.target.value)}
                    onBlur={() => {
                      if (value.zipCode.replace(/\D/g, '').length === 8) {
                        void onLookupCep();
                      }
                    }}
                    placeholder="00000-000"
                  />
                  <button
                    type="button"
                    className="btn"
                    disabled={lookupBusy !== null}
                    onClick={() => void onLookupCep()}
                  >
                    {lookupBusy === 'cep' ? 'Buscando…' : 'Buscar CEP'}
                  </button>
                </div>
              </div>
              <div className="field field--span-2">
                <label>Logradouro</label>
                <input
                  value={value.street}
                  onChange={(event) => set('street', event.target.value)}
                />
              </div>
              <div className="field">
                <label>Número</label>
                <input
                  value={value.number}
                  onChange={(event) => set('number', event.target.value)}
                />
              </div>
              <div className="field">
                <label>Complemento</label>
                <input
                  value={value.complement}
                  onChange={(event) => set('complement', event.target.value)}
                />
              </div>
              <div className="field">
                <label>Bairro</label>
                <input
                  value={value.district}
                  onChange={(event) => set('district', event.target.value)}
                />
              </div>
              <div className="field">
                <label>Cidade</label>
                <input
                  value={value.city}
                  onChange={(event) => set('city', event.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="product-form__section">
            <legend className="product-form__legend">Observações</legend>
            <div className="form-grid">
              <div className="field field--span-2">
                <label>Notas internas</label>
                <textarea
                  value={value.notes}
                  onChange={(event) => set('notes', event.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </fieldset>
        </>
      ) : (
        <fieldset className="product-form__section">
          <legend className="product-form__legend">Local</legend>
          <div className="form-grid">
            <div className="field">
              <label>Cidade</label>
              <input
                value={value.city}
                onChange={(event) => set('city', event.target.value)}
              />
            </div>
            <div className="field">
              <label>UF</label>
              <select
                value={value.uf}
                onChange={(event) => set('uf', event.target.value)}
              >
                <option value="">—</option>
                {UF_OPTIONS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>
      )}
    </div>
  );
}
