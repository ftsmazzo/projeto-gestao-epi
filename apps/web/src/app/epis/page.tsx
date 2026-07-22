'use client';

import type {
  EpiCategory,
  EpiItem,
  EpiUnitOfMeasure,
  EpiUsefulLifeUnit,
} from '@gestao-epi/shared';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import {
  createEpiItem,
  EpiVariantInput,
  listEpiItems,
  updateEpiItem,
  updateEpiItemStatus,
} from '../../lib/epis';

type FormMode = 'closed' | 'create' | 'edit';
type StatusFilter = 'all' | 'active' | 'inactive';

type VariantFormRow = {
  key: string;
  id?: string;
  size: string;
  color: string;
  model: string;
  side: string;
  notes: string;
  isActive: boolean;
};

type EpiFormState = {
  name: string;
  description: string;
  requiresCa: boolean;
  caNumber: string;
  caExpiresAt: string;
  unitOfMeasure: EpiUnitOfMeasure;
  usefulLifeValue: string;
  usefulLifeUnit: EpiUsefulLifeUnit;
  category: EpiCategory | '';
  externalCode: string;
  manufacturerName: string;
  reference: string;
  color: string;
  approvedFor: string;
  restriction: string;
  technicalNotes: string;
  nrr: string;
  nrrsf: string;
  variants: VariantFormRow[];
};

const CATEGORY_OPTIONS: { value: EpiCategory; label: string }[] = [
  { value: 'AUDITIVA', label: 'Auditiva' },
  { value: 'RESPIRATORIA', label: 'Respiratoria' },
  { value: 'QUEDA', label: 'Queda' },
  { value: 'MAOS', label: 'Maos' },
  { value: 'OLHOS', label: 'Olhos' },
  { value: 'CABECA', label: 'Cabeca' },
  { value: 'PES', label: 'Pes' },
  { value: 'TRONCO', label: 'Tronco' },
  { value: 'OUTROS', label: 'Outros' },
];

const UNIT_OPTIONS: { value: EpiUnitOfMeasure; label: string }[] = [
  { value: 'UNIDADE', label: 'Unidade' },
  { value: 'PAR', label: 'Par' },
  { value: 'CAIXA', label: 'Caixa' },
  { value: 'KIT', label: 'Kit' },
];

const LIFE_UNIT_OPTIONS: { value: EpiUsefulLifeUnit; label: string }[] = [
  { value: 'DIAS', label: 'Dias' },
  { value: 'MESES', label: 'Meses' },
  { value: 'ANOS', label: 'Anos' },
];

const emptyVariant = (): VariantFormRow => ({
  key: `new-${Math.random().toString(36).slice(2, 9)}`,
  size: '',
  color: '',
  model: '',
  side: '',
  notes: '',
  isActive: true,
});

const emptyForm: EpiFormState = {
  name: '',
  description: '',
  requiresCa: true,
  caNumber: '',
  caExpiresAt: '',
  unitOfMeasure: 'UNIDADE',
  usefulLifeValue: '',
  usefulLifeUnit: 'DIAS',
  category: '',
  externalCode: '',
  manufacturerName: '',
  reference: '',
  color: '',
  approvedFor: '',
  restriction: '',
  technicalNotes: '',
  nrr: '',
  nrrsf: '',
  variants: [],
};

function categoryLabel(value: EpiCategory | null) {
  if (!value) return '—';
  return CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function unitLabel(value: EpiUnitOfMeasure) {
  return UNIT_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function toDateInput(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}

function formatDateBr(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function normalizeCaInput(value: string) {
  return value.replace(/\s+/g, '');
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

function EpisContent() {
  const [items, setItems] = useState<EpiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [mode, setMode] = useState<FormMode>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EpiFormState>(emptyForm);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<EpiCategory | ''>('');

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setItems(await listEpiItems());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar o catalogo de EPIs.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === 'active' && !item.isActive) return false;
      if (statusFilter === 'inactive' && item.isActive) return false;
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (!query) return true;
      const haystack = [
        item.name,
        item.caNumber,
        item.externalCode,
        item.manufacturerName,
        item.reference,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [items, search, statusFilter, categoryFilter]);

  function openCreate() {
    setMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function openEdit(item: EpiItem) {
    setMode('edit');
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? '',
      requiresCa: item.requiresCa,
      caNumber: item.caNumber ?? '',
      caExpiresAt: toDateInput(item.caExpiresAt),
      unitOfMeasure: item.unitOfMeasure,
      usefulLifeValue:
        item.usefulLifeValue != null ? String(item.usefulLifeValue) : '',
      usefulLifeUnit: item.usefulLifeUnit ?? 'DIAS',
      category: item.category ?? '',
      externalCode: item.externalCode ?? '',
      manufacturerName: item.manufacturerName ?? '',
      reference: item.reference ?? '',
      color: item.color ?? '',
      approvedFor: item.approvedFor ?? '',
      restriction: item.restriction ?? '',
      technicalNotes: item.technicalNotes ?? '',
      nrr: item.nrr != null ? String(item.nrr) : '',
      nrrsf: item.nrrsf != null ? String(item.nrrsf) : '',
      variants: (item.variants ?? []).map((variant) => ({
        key: variant.id,
        id: variant.id,
        size: variant.size ?? '',
        color: variant.color ?? '',
        model: variant.model ?? '',
        side: variant.side ?? '',
        notes: variant.notes ?? '',
        isActive: variant.isActive,
      })),
    });
    setFormError(null);
  }

  function closeForm() {
    setMode('closed');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function updateVariant(
    key: string,
    patch: Partial<Omit<VariantFormRow, 'key'>>,
  ) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) =>
        variant.key === key ? { ...variant, ...patch } : variant,
      ),
    }));
  }

  function removeVariant(key: string) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((variant) => variant.key !== key),
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const caNumber = normalizeCaInput(form.caNumber.trim());
    if (form.requiresCa && !caNumber) {
      setFormError(
        'Este EPI exige CA. Informe o numero do Certificado de Aprovacao.',
      );
      return;
    }

    let usefulLifeValue: number | null = null;
    if (form.usefulLifeValue.trim()) {
      const parsed = Number(form.usefulLifeValue);
      if (!Number.isInteger(parsed) || parsed < 0) {
        setFormError('Vida util deve ser um inteiro maior ou igual a zero.');
        return;
      }
      usefulLifeValue = parsed;
    }

    const nrr = parseOptionalNumber(form.nrr);
    const nrrsf = parseOptionalNumber(form.nrrsf);
    if (Number.isNaN(nrr) || Number.isNaN(nrrsf)) {
      setFormError('NRR e NRRsf devem ser numeros validos.');
      return;
    }

    const variants: EpiVariantInput[] = [];
    for (const variant of form.variants) {
      const size = variant.size.trim() || null;
      const color = variant.color.trim() || null;
      const model = variant.model.trim() || null;
      const side = variant.side.trim() || null;
      const notes = variant.notes.trim() || null;
      if (!size && !color && !model && !side && !notes) {
        setFormError(
          'Remova variacoes vazias ou preencha tamanho, cor, modelo, lado ou observacao.',
        );
        return;
      }
      variants.push({
        id: variant.id,
        size,
        color,
        model,
        side,
        notes,
        isActive: variant.isActive,
      });
    }

    const isAuditory = form.category === 'AUDITIVA';
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      requiresCa: form.requiresCa,
      caNumber: caNumber || null,
      caExpiresAt: form.caExpiresAt || null,
      unitOfMeasure: form.unitOfMeasure,
      usefulLifeValue,
      usefulLifeUnit: usefulLifeValue == null ? null : form.usefulLifeUnit,
      category: form.category || null,
      externalCode: form.externalCode.trim() || null,
      manufacturerName: form.manufacturerName.trim() || null,
      reference: form.reference.trim() || null,
      color: form.color.trim() || null,
      approvedFor: form.approvedFor.trim() || null,
      restriction: form.restriction.trim() || null,
      technicalNotes: form.technicalNotes.trim() || null,
      nrr: isAuditory ? nrr : null,
      nrrsf: isAuditory ? nrrsf : null,
      variants,
    };

    setSaving(true);
    try {
      if (mode === 'create') {
        await createEpiItem(payload);
      } else if (mode === 'edit' && editingId) {
        await updateEpiItem(editingId, payload);
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Nao foi possivel salvar o EPI.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item: EpiItem) {
    setError(null);
    try {
      await updateEpiItemStatus(item.id, !item.isActive);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel atualizar o status do EPI.',
      );
    }
  }

  return (
    <div className="module-page epi-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Catalogo mestre</p>
          <h1 className="page-title">EPIs</h1>
          <p className="page-lead">
            Cadastro operacional com CA, dados oficiais do produto, vida util e
            grade. A consulta automatica a base CAEPI do Ministerio do Trabalho
            sera liberada em etapa futura.
          </p>
        </div>
        <div className="header-actions header-actions--wrap">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Novo EPI
          </button>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {mode !== 'closed' ? (
        <section className="surface epi-form-surface" aria-labelledby="epi-form-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">
                {mode === 'create' ? 'Novo cadastro' : 'Editar cadastro'}
              </p>
              <h2 id="epi-form-title" className="page-title page-title--sm">
                {mode === 'create' ? 'Novo EPI' : 'Editar EPI'}
              </h2>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeForm}
            >
              Cancelar
            </button>
          </div>

          <form className="form form--wide epi-form" onSubmit={onSubmit} noValidate>
            <section className="epi-form-section" aria-labelledby="sec-main">
              <div className="epi-form-section__head">
                <h3 id="sec-main">Dados principais</h3>
                <p>Identificacao basica do equipamento no catalogo.</p>
              </div>
              <div className="form-grid">
                <div className="field field--span-2">
                  <label htmlFor="epi-name">Nome</label>
                  <input
                    id="epi-name"
                    required
                    minLength={2}
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="epi-category">Categoria</label>
                  <select
                    id="epi-category"
                    value={form.category}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        category: e.target.value as EpiCategory | '',
                      }))
                    }
                  >
                    <option value="">Sem categoria</option>
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="epi-external">Codigo externo</label>
                  <input
                    id="epi-external"
                    placeholder="ERP / legado"
                    value={form.externalCode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        externalCode: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field field--span-2">
                  <label htmlFor="epi-description">Descricao</label>
                  <textarea
                    id="epi-description"
                    rows={2}
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </section>

            <section className="epi-form-section" aria-labelledby="sec-ca">
              <div className="epi-form-section__head">
                <h3 id="sec-ca">CA e conformidade</h3>
                <p>
                  Prepare o vinculo com a base oficial CAEPI. A busca automatica
                  ainda nao consulta a fonte externa.
                </p>
              </div>
              <div className="form-grid">
                <div className="field field--span-2">
                  <label htmlFor="epi-requires-ca">Exige CA?</label>
                  <label className="field-check" htmlFor="epi-requires-ca">
                    <input
                      id="epi-requires-ca"
                      type="checkbox"
                      checked={form.requiresCa}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          requiresCa: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      {form.requiresCa
                        ? 'Sim — numero do CA obrigatorio'
                        : 'Nao — permitido cadastrar sem CA'}
                    </span>
                  </label>
                </div>
                <div className="field">
                  <label htmlFor="epi-ca">
                    Numero do CA{form.requiresCa ? '' : ' (opcional)'}
                  </label>
                  <input
                    id="epi-ca"
                    autoComplete="off"
                    required={form.requiresCa}
                    placeholder="Ex.: 12345"
                    value={form.caNumber}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        caNumber: normalizeCaInput(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="epi-ca-exp">Validade do CA</label>
                  <input
                    id="epi-ca-exp"
                    type="date"
                    value={form.caExpiresAt}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        caExpiresAt: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <aside className="caepi-slot" aria-label="Consulta CAEPI">
                <div>
                  <p className="page-kicker">Base oficial CAEPI</p>
                  <p className="field-hint">
                    Em breve: ao informar o CA, o sistema buscara fabricante,
                    validade e dados do produto na base local importada do
                    Ministerio do Trabalho. Por enquanto, preencha manualmente.
                  </p>
                </div>
                <button type="button" className="btn btn-secondary" disabled>
                  Buscar dados do CA (em breve)
                </button>
              </aside>
            </section>

            <section className="epi-form-section" aria-labelledby="sec-official">
              <div className="epi-form-section__head">
                <h3 id="sec-official">Dados oficiais do produto</h3>
                <p>
                  Campos alinhados ao que a consulta CAEPI devera preencher
                  automaticamente.
                </p>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="epi-manufacturer">Fabricante</label>
                  <input
                    id="epi-manufacturer"
                    value={form.manufacturerName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        manufacturerName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="epi-reference">Referencia / modelo</label>
                  <input
                    id="epi-reference"
                    value={form.reference}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        reference: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="epi-color">Cor</label>
                  <input
                    id="epi-color"
                    value={form.color}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, color: e.target.value }))
                    }
                  />
                </div>
                <div className="field field--span-2">
                  <label htmlFor="epi-approved">Aprovado para</label>
                  <textarea
                    id="epi-approved"
                    rows={2}
                    value={form.approvedFor}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        approvedFor: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field field--span-2">
                  <label htmlFor="epi-restriction">Restricao</label>
                  <textarea
                    id="epi-restriction"
                    rows={2}
                    value={form.restriction}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        restriction: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </section>

            <section className="epi-form-section" aria-labelledby="sec-life">
              <div className="epi-form-section__head">
                <h3 id="sec-life">Unidade e vida util</h3>
                <p>Parametros operacionais para uso futuro em estoque e entregas.</p>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="epi-uom">Unidade de medida</label>
                  <select
                    id="epi-uom"
                    value={form.unitOfMeasure}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        unitOfMeasure: e.target.value as EpiUnitOfMeasure,
                      }))
                    }
                  >
                    {UNIT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="epi-life-value">Vida util</label>
                  <input
                    id="epi-life-value"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Ex.: 720"
                    value={form.usefulLifeValue}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        usefulLifeValue: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="epi-life-unit">Unidade da vida util</label>
                  <select
                    id="epi-life-unit"
                    value={form.usefulLifeUnit}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        usefulLifeUnit: e.target.value as EpiUsefulLifeUnit,
                      }))
                    }
                  >
                    {LIFE_UNIT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="epi-form-section" aria-labelledby="sec-variants">
              <div className="epi-form-section__head">
                <div>
                  <h3 id="sec-variants">Grade / variacoes</h3>
                  <p>Tamanhos, cores, modelos e lados usados na operacao.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      variants: [...prev.variants, emptyVariant()],
                    }))
                  }
                >
                  Adicionar variacao
                </button>
              </div>

              {form.variants.length === 0 ? (
                <p className="field-hint">
                  Nenhuma variacao. Use quando o mesmo EPI tiver grade (ex.: P/M/G).
                </p>
              ) : (
                <div className="variant-list">
                  {form.variants.map((variant, index) => (
                    <div className="variant-row" key={variant.key}>
                      <p className="variant-row__label">Variacao {index + 1}</p>
                      <div className="form-grid">
                        <div className="field">
                          <label htmlFor={`v-size-${variant.key}`}>Tamanho</label>
                          <input
                            id={`v-size-${variant.key}`}
                            value={variant.size}
                            onChange={(e) =>
                              updateVariant(variant.key, {
                                size: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`v-color-${variant.key}`}>Cor</label>
                          <input
                            id={`v-color-${variant.key}`}
                            value={variant.color}
                            onChange={(e) =>
                              updateVariant(variant.key, {
                                color: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`v-model-${variant.key}`}>Modelo</label>
                          <input
                            id={`v-model-${variant.key}`}
                            value={variant.model}
                            onChange={(e) =>
                              updateVariant(variant.key, {
                                model: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`v-side-${variant.key}`}>Lado</label>
                          <input
                            id={`v-side-${variant.key}`}
                            placeholder="Esq. / Dir."
                            value={variant.side}
                            onChange={(e) =>
                              updateVariant(variant.key, {
                                side: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="field field--span-2">
                          <label htmlFor={`v-notes-${variant.key}`}>
                            Observacao
                          </label>
                          <input
                            id={`v-notes-${variant.key}`}
                            value={variant.notes}
                            onChange={(e) =>
                              updateVariant(variant.key, {
                                notes: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="variant-row__actions">
                        <label className="field-check">
                          <input
                            type="checkbox"
                            checked={variant.isActive}
                            onChange={(e) =>
                              updateVariant(variant.key, {
                                isActive: e.target.checked,
                              })
                            }
                          />
                          <span>Ativa</span>
                        </label>
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          onClick={() => removeVariant(variant.key)}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="epi-form-section" aria-labelledby="sec-tech">
              <div className="epi-form-section__head">
                <h3 id="sec-tech">Campos tecnicos</h3>
                <p>
                  Observacoes tecnicas gerais
                  {form.category === 'AUDITIVA'
                    ? ' e atenuacao para protecao auditiva.'
                    : '.'}
                </p>
              </div>
              {form.category === 'AUDITIVA' ? (
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="epi-nrr">NRR</label>
                    <input
                      id="epi-nrr"
                      type="number"
                      step="0.1"
                      value={form.nrr}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, nrr: e.target.value }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="epi-nrrsf">NRRsf</label>
                    <input
                      id="epi-nrrsf"
                      type="number"
                      step="0.1"
                      value={form.nrrsf}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, nrrsf: e.target.value }))
                      }
                    />
                  </div>
                </div>
              ) : (
                <p className="field-hint">
                  NRR e NRRsf aparecem quando a categoria for Auditiva.
                </p>
              )}
              <div className="field" style={{ marginTop: '0.85rem' }}>
                <label htmlFor="epi-tech-notes">Observacoes tecnicas</label>
                <textarea
                  id="epi-tech-notes"
                  rows={3}
                  value={form.technicalNotes}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      technicalNotes: e.target.value,
                    }))
                  }
                />
              </div>
            </section>

            {formError ? (
              <p className="error" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="btn-row">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Salvando...'
                  : mode === 'create'
                    ? 'Cadastrar EPI'
                    : 'Salvar alteracoes'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeForm}
                disabled={saving}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="surface" aria-labelledby="epis-list-title">
        <div className="form-section-header">
          <div>
            <p className="page-kicker">Lista</p>
            <h2 id="epis-list-title" className="page-title page-title--sm">
              Catalogo da organizacao
            </h2>
          </div>
        </div>

        <div className="epi-filters" aria-label="Filtros do catalogo">
          <div className="field">
            <label htmlFor="epi-search">Buscar</label>
            <input
              id="epi-search"
              placeholder="Nome, CA, codigo externo ou fabricante"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="epi-filter-status">Status</label>
            <select
              id="epi-filter-status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusFilter)
              }
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="epi-filter-category">Categoria</label>
            <select
              id="epi-filter-category"
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as EpiCategory | '')
              }
            >
              <option value="">Todas</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="page-lead">Carregando catalogo...</p>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <p className="page-title page-title--sm">Nenhum EPI cadastrado</p>
            <p className="page-lead">
              Cadastre o primeiro equipamento do catalogo mestre. Estoque e
              entregas usarao estes itens depois.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
            >
              Cadastrar primeiro EPI
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <p className="page-title page-title--sm">Nenhum resultado</p>
            <p className="page-lead">
              Ajuste a busca ou os filtros para encontrar EPIs no catalogo.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Unidade</th>
                  <th scope="col">CA</th>
                  <th scope="col">Validade CA</th>
                  <th scope="col">Fabricante</th>
                  <th scope="col">Status</th>
                  <th scope="col">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      {item.externalCode ? (
                        <span className="table-sub">
                          Cod. {item.externalCode}
                        </span>
                      ) : null}
                      {item.variants?.length ? (
                        <span className="table-sub">
                          {item.variants.length} variacao(oes)
                        </span>
                      ) : null}
                    </td>
                    <td>{categoryLabel(item.category)}</td>
                    <td>{unitLabel(item.unitOfMeasure)}</td>
                    <td className="mono">
                      {item.caNumber ? item.caNumber : 'Sem CA'}
                    </td>
                    <td>{formatDateBr(item.caExpiresAt)}</td>
                    <td>{item.manufacturerName || '—'}</td>
                    <td>
                      <span
                        className={`status-pill status-pill--${item.isActive ? 'active' : 'inactive'}`}
                      >
                        {item.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          onClick={() => openEdit(item)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          onClick={() => void toggleStatus(item)}
                        >
                          {item.isActive ? 'Inativar' : 'Reativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function EpisPage() {
  return (
    <RequireAuth>
      {() => <EpisContent />}
    </RequireAuth>
  );
}
