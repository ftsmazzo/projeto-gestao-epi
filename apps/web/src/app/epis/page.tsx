'use client';

import type {
  CaCertificate,
  CaCertificateSearchItem,
  EpiCategory,
  EpiImportPreviewResponse,
  EpiItem,
  EpiUnitOfMeasure,
  EpiUsefulLifeUnit,
} from '@gestao-epi/shared';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { RequireAuth } from '../../components/RequireAuth';
import {
  buildCaepiFormPatch,
  caStatusClassName,
  EPI_COLOR_OPTIONS,
  EPI_SIDE_OPTIONS,
  EPI_SIZE_OPTIONS,
  formatCaStatusLabel,
  mergeSelectOptions,
  normalizeCaLookupInput,
} from '../../lib/caepi-assist';
import { lookupCaCertificate, searchCaCertificates } from '../../lib/caepi';
import {
  confirmEpiCsvImport,
  createEpiItem,
  downloadCsvText,
  EPI_CSV_TEMPLATE_LOCAL,
  EpiVariantInput,
  getEpiCsvTemplate,
  listEpiItems,
  previewEpiCsvImport,
  updateEpiItem,
  updateEpiItemStatus,
} from '../../lib/epis';
import { listStockTotalsByEpi } from '../../lib/stock';

const CAEPI_SEARCH_DEBOUNCE_MS = 350;
const CAEPI_SEARCH_MIN_CHARS = 3;

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
  const [caLookupLoading, setCaLookupLoading] = useState(false);
  const [caLookupError, setCaLookupError] = useState<string | null>(null);
  const [caLookupMessage, setCaLookupMessage] = useState<string | null>(null);
  const [caPreview, setCaPreview] = useState<CaCertificate | null>(null);
  const [caAppliedBanner, setCaAppliedBanner] = useState<string | null>(null);
  const [nameAppliedBanner, setNameAppliedBanner] = useState<string | null>(
    null,
  );
  const [nameAssistError, setNameAssistError] = useState<string | null>(null);
  const [caLookupInput, setCaLookupInput] = useState('');
  const [caSuggestions, setCaSuggestions] = useState<CaCertificateSearchItem[]>(
    [],
  );
  const [caSuggestLoading, setCaSuggestLoading] = useState(false);
  const [caSuggestOpen, setCaSuggestOpen] = useState(false);
  const [caSuggestQuery, setCaSuggestQuery] = useState('');
  const caSuggestSeq = useRef(0);
  const caSuggestBoxRef = useRef<HTMLDivElement | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importPreview, setImportPreview] =
    useState<EpiImportPreviewResponse | null>(null);
  const [importResultMessage, setImportResultMessage] = useState<string | null>(
    null,
  );
  const [stockTotalsByEpi, setStockTotalsByEpi] = useState<
    Record<string, number>
  >({});

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [list, totals] = await Promise.all([
        listEpiItems(),
        listStockTotalsByEpi().catch(() => []),
      ]);
      setItems(list);
      const map: Record<string, number> = {};
      for (const row of totals) {
        map[row.epiItemId] = row.totalQuantity;
      }
      setStockTotalsByEpi(map);
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

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!caSuggestBoxRef.current) return;
      if (!caSuggestBoxRef.current.contains(event.target as Node)) {
        setCaSuggestOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (mode === 'closed') {
      setCaSuggestions([]);
      setCaSuggestOpen(false);
      setCaSuggestQuery('');
      return;
    }

    const term = caSuggestQuery.trim();
    if (term.length < CAEPI_SEARCH_MIN_CHARS) {
      setCaSuggestions([]);
      setCaSuggestLoading(false);
      return;
    }

    const seq = ++caSuggestSeq.current;
    setCaSuggestLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await searchCaCertificates(term, 10);
          if (seq !== caSuggestSeq.current) return;
          setCaSuggestions(result.items);
          setCaSuggestOpen(true);
          if (result.baseIncomplete && result.message) {
            setCaLookupMessage(result.message);
          } else if (result.items.length === 0 && result.message) {
            setCaLookupMessage(result.message);
          } else if (!result.baseIncomplete) {
            setCaLookupMessage(null);
          }
        } catch (err) {
          if (seq !== caSuggestSeq.current) return;
          setCaSuggestions([]);
          const message =
            err instanceof Error
              ? err.message
              : 'Falha de rede ao buscar sugestoes CAEPI.';
          setCaLookupError(
            /nao autoriz|unauthorized|401|403/i.test(message)
              ? 'Sessao expirada ou sem permissao. Entre novamente e tente a consulta.'
              : `Erro de API/rede na busca CAEPI: ${message}`,
          );
        } finally {
          if (seq === caSuggestSeq.current) {
            setCaSuggestLoading(false);
          }
        }
      })();
    }, CAEPI_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [caSuggestQuery, mode]);

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

  function clearCaAssistState() {
    setCaPreview(null);
    setCaLookupError(null);
    setCaLookupMessage(null);
    setCaAppliedBanner(null);
    setNameAppliedBanner(null);
    setNameAssistError(null);
    setCaLookupInput('');
    setCaSuggestions([]);
    setCaSuggestOpen(false);
    setCaSuggestQuery('');
  }

  function openCreate() {
    setMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    clearCaAssistState();
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
    clearCaAssistState();
  }

  function closeForm() {
    setMode('closed');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    clearCaAssistState();
  }

  async function openCaPreview(caNumberRaw: string) {
    const caNumber = normalizeCaLookupInput(caNumberRaw);
    setCaLookupError(null);
    setCaLookupMessage(null);
    setCaPreview(null);
    setCaAppliedBanner(null);
    setNameAppliedBanner(null);
    setNameAssistError(null);

    if (!caNumber) {
      setCaLookupError('Informe o numero do CA para consultar a base local.');
      return;
    }

    setCaLookupLoading(true);
    try {
      const result = await lookupCaCertificate(caNumber);
      if (!result.found || !result.certificate) {
        if (result.baseIncomplete) {
          setCaLookupMessage(
            result.message ??
              'Base CAEPI local ainda nao importada ou incompleta. Atualize a base oficial CAEPI pelo painel Base CAEPI.',
          );
        } else {
          setCaLookupMessage(
            result.message ??
              `CA ${caNumber} nao encontrado na base CAEPI local.`,
          );
        }
        return;
      }
      setCaPreview(result.certificate);
      setCaLookupInput(result.certificate.caNumber);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha ao consultar o CA.';
      if (/nao autoriz|unauthorized|401|403/i.test(message)) {
        setCaLookupError(
          'Sessao expirada ou sem permissao. Entre novamente e tente a consulta.',
        );
      } else {
        setCaLookupError(`Erro de API/rede: ${message}`);
      }
    } finally {
      setCaLookupLoading(false);
    }
  }

  async function onLookupCa() {
    await openCaPreview(caLookupInput);
  }

  function applyCertificateToForm(
    certificate: NonNullable<typeof caPreview>,
    options?: { replaceName?: boolean; seedVariants?: boolean },
  ) {
    const patch = buildCaepiFormPatch(certificate);
    const replaceName = options?.replaceName ?? false;
    const seedVariants = options?.seedVariants ?? true;

    const currentDescription = form.description.trim();
    const officialDescription = patch.description?.trim() || '';

    let nextDescription = currentDescription;
    if (officialDescription) {
      if (!currentDescription) {
        nextDescription = officialDescription;
      } else if (currentDescription !== officialDescription) {
        const confirmed = window.confirm(
          'A descricao atual sera substituida pela descricao oficial do equipamento. Continuar?',
        );
        if (!confirmed) {
          return false;
        }
        nextDescription = officialDescription;
      }
    }

    setForm((prev) => {
      const nextName =
        replaceName || !prev.name.trim()
          ? patch.name || prev.name
          : prev.name;

      let nextVariants = prev.variants;
      if (seedVariants && patch.variantSeeds.length > 0) {
        const hasMeaningfulVariant = prev.variants.some(
          (variant) =>
            variant.size.trim() ||
            variant.color.trim() ||
            variant.model.trim() ||
            variant.side.trim() ||
            variant.notes.trim(),
        );
        if (!hasMeaningfulVariant) {
          nextVariants = patch.variantSeeds.map((seed) => ({
            key: `new-${Math.random().toString(36).slice(2, 9)}`,
            ...seed,
          }));
        }
      }

      return {
        ...prev,
        name: nextName,
        requiresCa: true,
        caNumber: patch.caNumber,
        caExpiresAt: patch.caExpiresAt,
        manufacturerName: patch.manufacturerName,
        reference: patch.reference,
        color: patch.color,
        approvedFor: patch.approvedFor,
        restriction: patch.restriction,
        technicalNotes: patch.technicalNotes,
        category: patch.category,
        unitOfMeasure: patch.unitOfMeasure,
        description: nextDescription,
        variants: nextVariants,
      };
    });

    return true;
  }

  /** Fluxo por nome: preenche o formulario sem abrir previa CAEPI. */
  async function onSelectNameSuggestion(item: CaCertificateSearchItem) {
    setCaSuggestOpen(false);
    setCaPreview(null);
    setCaAppliedBanner(null);
    setCaLookupError(null);
    setCaLookupMessage(null);
    setNameAppliedBanner(null);
    setNameAssistError(null);
    setCaLookupLoading(true);

    try {
      const result = await lookupCaCertificate(item.caNumber);
      if (!result.found || !result.certificate) {
        setNameAssistError(
          result.message ??
            `CA ${item.caNumber} nao encontrado na base CAEPI local.`,
        );
        return;
      }

      const applied = applyCertificateToForm(result.certificate, {
        replaceName: true,
        seedVariants: true,
      });
      if (applied) {
        setNameAppliedBanner(
          `Dados do CA ${result.certificate.caNumber} preenchidos pela busca por nome. Revise e salve o cadastro.`,
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha ao consultar o CA.';
      setNameAssistError(`Erro de API/rede: ${message}`);
    } finally {
      setCaLookupLoading(false);
    }
  }

  function onApplyCaPreview() {
    if (!caPreview) {
      return;
    }
    const applied = applyCertificateToForm(caPreview, {
      replaceName: !form.name.trim(),
      seedVariants: true,
    });
    if (applied) {
      setCaAppliedBanner(
        `Dados do CA ${caPreview.caNumber} aplicados a partir da busca por CA. Revise e salve o cadastro.`,
      );
      setNameAppliedBanner(null);
      setCaPreview(null);
    }
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

  function openImportPanel() {
    setImportOpen(true);
    setImportError(null);
    setImportResultMessage(null);
    setImportPreview(null);
    setImportFileName(null);
    if (importFileRef.current) {
      importFileRef.current.value = '';
    }
  }

  function closeImportPanel() {
    setImportOpen(false);
    setImportError(null);
    setImportBusy(false);
    setImportPreview(null);
    setImportFileName(null);
  }

  async function onDownloadCsvTemplate() {
    try {
      const template = await getEpiCsvTemplate();
      downloadCsvText(template.fileName, template.csvText);
    } catch {
      downloadCsvText('modelo-importacao-epis.csv', EPI_CSV_TEMPLATE_LOCAL);
    }
  }

  async function onImportFileSelected(file: File | null) {
    if (!file) return;
    setImportError(null);
    setImportResultMessage(null);
    setImportBusy(true);
    setImportFileName(file.name);
    try {
      const csvText = await file.text();
      const preview = await previewEpiCsvImport(csvText);
      setImportPreview(preview);
    } catch (err) {
      setImportPreview(null);
      setImportError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel gerar a previa do CSV.',
      );
    } finally {
      setImportBusy(false);
    }
  }

  async function onConfirmImport() {
    if (!importPreview) return;
    const rows = importPreview.rows
      .filter((row) => row.ok && row.payload)
      .map((row) => ({
        rowNumber: row.rowNumber,
        payload: row.payload!,
      }));
    if (rows.length === 0) {
      setImportError('Nenhuma linha valida para confirmar.');
      return;
    }

    setImportBusy(true);
    setImportError(null);
    try {
      const result = await confirmEpiCsvImport(rows);
      setImportResultMessage(
        `Importacao concluida: ${result.created} criado(s), ${result.updated} atualizado(s), ${result.variantsCreated} variacao(oes).${
          result.failed > 0 ? ` Falhas: ${result.failed}.` : ''
        }`,
      );
      if (result.errors.length > 0) {
        setImportError(
          result.errors
            .map((item) => `Linha ${item.rowNumber}: ${item.message}`)
            .join(' | '),
        );
      }
      setImportPreview(null);
      await load();
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel confirmar a importacao.',
      );
    } finally {
      setImportBusy(false);
    }
  }

  const importHasBlockingErrors = Boolean(
    importPreview && importPreview.totals.withErrors > 0,
  );
  const importCanConfirm = Boolean(
    importPreview &&
      importPreview.totals.valid > 0 &&
      !importHasBlockingErrors &&
      !importBusy,
  );

  return (
    <div className="module-page epi-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Catalogo mestre</p>
          <h1 className="page-title">EPIs</h1>
          <p className="page-lead">
            Cadastro operacional com CA, dados oficiais do produto, vida util e
            grade. Consulte a base local CAEPI para preencher campos oficiais
            com revisao antes de salvar.
          </p>
        </div>
        <div className="header-actions header-actions--wrap">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={openImportPanel}
          >
            Importar CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Novo EPI
          </button>
        </div>
      </header>

      {importOpen ? (
        <section className="surface epi-import-panel" aria-labelledby="epi-import-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Importacao em lote</p>
              <h2 id="epi-import-title" className="page-title page-title--sm">
                Importar EPIs por CSV
              </h2>
              <p className="page-lead">
                Envie a lista do cliente, revise a previa (com enriquecimento
                CAEPI quando houver CA) e confirme antes de gravar.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeImportPanel}
              disabled={importBusy}
            >
              Fechar
            </button>
          </div>

          <div className="epi-import-guide">
            <p className="field-hint">
              Colunas aceitas (PT ou tecnico): nome/name, ca/caNumber,
              exige_ca/requiresCa, unidade/unitOfMeasure, vida_util,
              unidade_vida_util, categoria, codigo_externo, fabricante,
              referencia, cor, tamanho, modelo e demais campos oficiais.
              Colunas desconhecidas sao ignoradas com aviso.
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void onDownloadCsvTemplate()}
              >
                Baixar modelo CSV
              </button>
              <label className="btn btn-primary" htmlFor="epi-csv-file">
                {importBusy ? 'Processando...' : 'Selecionar CSV'}
              </label>
              <input
                id="epi-csv-file"
                ref={importFileRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                disabled={importBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  void onImportFileSelected(file);
                }}
              />
            </div>
            {importFileName ? (
              <p className="field-hint">Arquivo: {importFileName}</p>
            ) : null}
          </div>

          {importError ? (
            <p className="error" role="alert">
              {importError}
            </p>
          ) : null}
          {importResultMessage ? (
            <p className="caepi-applied" role="status">
              {importResultMessage}
            </p>
          ) : null}

          {importPreview ? (
            <>
              {importPreview.unknownColumns.length > 0 ? (
                <p className="caepi-message" role="status">
                  Colunas ignoradas: {importPreview.unknownColumns.join(', ')}
                </p>
              ) : null}

              <section className="quota-summary" aria-label="Resumo da previa">
                <div className="quota-summary-item">
                  <span className="quota-summary-label">Lidas</span>
                  <strong className="quota-summary-value">
                    {importPreview.totals.rowsRead}
                  </strong>
                </div>
                <div className="quota-summary-item">
                  <span className="quota-summary-label">Validas</span>
                  <strong className="quota-summary-value">
                    {importPreview.totals.valid}
                  </strong>
                </div>
                <div className="quota-summary-item">
                  <span className="quota-summary-label">Com erro</span>
                  <strong className="quota-summary-value">
                    {importPreview.totals.withErrors}
                  </strong>
                </div>
                <div className="quota-summary-item">
                  <span className="quota-summary-label">Enriquecidas</span>
                  <strong className="quota-summary-value">
                    {importPreview.totals.enrichedFromCaepi}
                  </strong>
                </div>
                <div className="quota-summary-item">
                  <span className="quota-summary-label">CA nao encontrado</span>
                  <strong className="quota-summary-value">
                    {importPreview.totals.caNotFound}
                  </strong>
                </div>
                <div className="quota-summary-item">
                  <span className="quota-summary-label">Atualizacoes</span>
                  <strong className="quota-summary-value">
                    {importPreview.totals.conflicts}
                  </strong>
                </div>
              </section>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Linha</th>
                      <th scope="col">Status</th>
                      <th scope="col">Nome / CA</th>
                      <th scope="col">Acao</th>
                      <th scope="col">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="mono">{row.rowNumber}</td>
                        <td>
                          <div className="epi-import-badges">
                            <span
                              className={`status-pill status-pill--${
                                row.ok ? 'active' : 'inactive'
                              }`}
                            >
                              {row.ok ? 'Valido' : 'Erro'}
                            </span>
                            {row.warnings.length > 0 ? (
                              <span className="status-pill status-pill--warn">
                                Aviso
                              </span>
                            ) : null}
                            {row.enrichedFromCaepi ? (
                              <span className="status-pill status-pill--info">
                                CAEPI
                              </span>
                            ) : null}
                            {row.caStatus &&
                            row.caStatus !== 'VALIDO' &&
                            row.caStatus !== 'DESCONHECIDO' ? (
                              <span className={caStatusClassName(row.caStatus)}>
                                {formatCaStatusLabel(row.caStatus)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <strong>
                            {row.payload?.name || '—'}
                          </strong>
                          <span className="table-sub">
                            CA {row.payload?.caNumber || '—'}
                            {row.payload?.externalCode
                              ? ` · ${row.payload.externalCode}`
                              : ''}
                          </span>
                        </td>
                        <td>
                          {row.action === 'update'
                            ? 'Atualizar'
                            : row.action === 'create'
                              ? 'Criar'
                              : '—'}
                        </td>
                        <td>
                          {row.errors.length > 0 ? (
                            <span className="error">{row.errors.join(' ')}</span>
                          ) : row.warnings.length > 0 ? (
                            <span className="field-hint">
                              {row.warnings.join(' ')}
                            </span>
                          ) : (
                            <span className="field-hint">Pronto para gravar</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!importCanConfirm}
                  onClick={() => void onConfirmImport()}
                >
                  {importBusy ? 'Confirmando...' : 'Confirmar importacao'}
                </button>
                {importHasBlockingErrors ? (
                  <p className="field-hint">
                    Corrija as linhas com erro no CSV e gere a previa novamente.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

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
                <div className="field field--span-2 caepi-suggest-wrap" ref={caSuggestBoxRef}>
                  <label htmlFor="epi-name">Nome / equipamento</label>
                  <input
                    id="epi-name"
                    required
                    minLength={2}
                    autoComplete="off"
                    value={form.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm((prev) => ({ ...prev, name: value }));
                      setNameAppliedBanner(null);
                      setNameAssistError(null);
                      setCaSuggestQuery(value);
                      setCaSuggestOpen(
                        value.trim().length >= CAEPI_SEARCH_MIN_CHARS,
                      );
                    }}
                    onFocus={() => {
                      if (
                        form.name.trim().length >= CAEPI_SEARCH_MIN_CHARS &&
                        caSuggestions.length > 0
                      ) {
                        setCaSuggestOpen(true);
                      }
                    }}
                  />
                  <p className="field-hint">
                    Digite ao menos 3 caracteres para sugerir CAs. Ao escolher
                    uma sugestao, os campos do cadastro sao preenchidos
                    automaticamente (sem abrir previa).
                  </p>
                  {nameAssistError ? (
                    <p className="error" role="alert">
                      {nameAssistError}
                    </p>
                  ) : null}
                  {nameAppliedBanner ? (
                    <p className="caepi-applied" role="status">
                      {nameAppliedBanner}
                    </p>
                  ) : null}
                  {caSuggestOpen &&
                  (caSuggestLoading || caSuggestions.length > 0) &&
                  caSuggestQuery.trim().length >= CAEPI_SEARCH_MIN_CHARS ? (
                    <ul className="caepi-suggest-list" role="listbox">
                      {caSuggestLoading ? (
                        <li className="caepi-suggest-item caepi-suggest-item--muted">
                          Buscando sugestoes...
                        </li>
                      ) : (
                        caSuggestions.map((item) => (
                          <li key={item.caNumber}>
                            <button
                              type="button"
                              className="caepi-suggest-item"
                              onClick={() => void onSelectNameSuggestion(item)}
                            >
                              <span className="caepi-suggest-item__ca">
                                CA {item.caNumber}
                              </span>
                              <span
                                className={caStatusClassName(item.status)}
                              >
                                {formatCaStatusLabel(item.status)}
                              </span>
                              <span className="caepi-suggest-item__meta">
                                {item.equipmentName || 'Equipamento nao informado'}
                              </span>
                              <span className="caepi-suggest-item__meta">
                                {item.manufacturerName || 'Fabricante nao informado'}
                              </span>
                              {item.reference ? (
                                <span className="caepi-suggest-item__meta">
                                  Ref. {item.reference}
                                </span>
                              ) : null}
                              <span className="caepi-suggest-item__meta">
                                Validade {formatDateBr(item.expiresAt)}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
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
                  Informe o CA do cadastro. Para preencher pela base oficial,
                  use o bloco de busca por CA abaixo.
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
                    placeholder="Ex.: 53388"
                    value={form.caNumber}
                    onChange={(e) => {
                      const value = normalizeCaInput(e.target.value);
                      setForm((prev) => ({
                        ...prev,
                        caNumber: value,
                      }));
                    }}
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
            </section>

            <section className="epi-form-section" aria-labelledby="sec-ca-lookup">
              <div className="epi-form-section__head">
                <h3 id="sec-ca-lookup">Busca por CA</h3>
                <p>
                  Use quando voce sabe o numero do CA. A previa aparece e so
                  inclui dados ao confirmar.
                </p>
              </div>

              <div className="caepi-slot caepi-slot--lookup">
                <div className="field" style={{ flex: '1 1 14rem', margin: 0 }}>
                  <label htmlFor="epi-ca-lookup">
                    Consultar CA na base local
                  </label>
                  <input
                    id="epi-ca-lookup"
                    autoComplete="off"
                    placeholder="Digite o numero do CA"
                    value={caLookupInput}
                    onChange={(e) => {
                      setCaLookupInput(normalizeCaInput(e.target.value));
                      setCaPreview(null);
                      setCaLookupError(null);
                      setCaLookupMessage(null);
                      setCaAppliedBanner(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void onLookupCa();
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={caLookupLoading || !caLookupInput.trim()}
                  onClick={() => void onLookupCa()}
                >
                  {caLookupLoading ? 'Buscando...' : 'Buscar dados do CA'}
                </button>
              </div>

              {caLookupError ? (
                <p className="error" role="alert">
                  {caLookupError}
                </p>
              ) : null}
              {caLookupMessage ? (
                <p className="caepi-message" role="status">
                  {caLookupMessage}{' '}
                  {/base caepi|incompleta|nao importada/i.test(
                    caLookupMessage,
                  ) ? (
                    <Link href="/caepi">Atualizar no painel Base CAEPI</Link>
                  ) : null}
                </p>
              ) : null}
              {caAppliedBanner ? (
                <p className="caepi-applied" role="status">
                  {caAppliedBanner}
                </p>
              ) : null}

              {caPreview ? (
                <div
                  className={`caepi-preview caepi-preview--${caPreview.status.toLowerCase()}`}
                  aria-label="Previa dos dados oficiais do CA"
                >
                  <div className="caepi-preview__head">
                    <div>
                      <p className="page-kicker">Previa CAEPI</p>
                      <h4 className="caepi-preview__title">
                        CA {caPreview.caNumber}
                      </h4>
                      <p className="field-hint">
                        Fonte: base local CAEPI
                        {caPreview.sourceImportedAt
                          ? ` · importada em ${formatDateBr(caPreview.sourceImportedAt)}`
                          : ''}
                      </p>
                    </div>
                    <span className={caStatusClassName(caPreview.status)}>
                      {formatCaStatusLabel(caPreview.status)}
                    </span>
                  </div>

                  {caPreview.status === 'VALIDO' ? (
                    <p className="caepi-alert caepi-alert--ok">
                      CA com situacao valida na base local.
                    </p>
                  ) : null}
                  {caPreview.status === 'VENCIDO' ||
                  caPreview.status === 'CANCELADO' ||
                  caPreview.status === 'SUSPENSO' ? (
                    <p className="caepi-alert caepi-alert--warn" role="alert">
                      Atencao: este CA esta{' '}
                      {formatCaStatusLabel(caPreview.status).toLowerCase()}.
                      Voce ainda pode aplicar os dados e decidir se salva o
                      cadastro.
                    </p>
                  ) : null}

                  <dl className="caepi-preview__grid">
                    <div>
                      <dt>Validade</dt>
                      <dd>{formatDateBr(caPreview.expiresAt)}</dd>
                    </div>
                    <div>
                      <dt>Fabricante</dt>
                      <dd>{caPreview.manufacturerName || '—'}</dd>
                    </div>
                    <div>
                      <dt>Equipamento</dt>
                      <dd>{caPreview.equipmentName || '—'}</dd>
                    </div>
                    <div>
                      <dt>Referencia</dt>
                      <dd>{caPreview.reference || '—'}</dd>
                    </div>
                    <div>
                      <dt>Cor</dt>
                      <dd>{caPreview.color || '—'}</dd>
                    </div>
                    <div>
                      <dt>Aprovado para</dt>
                      <dd>{caPreview.approvedFor || '—'}</dd>
                    </div>
                    <div className="caepi-preview__span">
                      <dt>Restricao</dt>
                      <dd>{caPreview.restriction || '—'}</dd>
                    </div>
                    <div className="caepi-preview__span">
                      <dt>Observacoes</dt>
                      <dd>{caPreview.analysisNotes || '—'}</dd>
                    </div>
                  </dl>

                  {caPreview.norms?.length ? (
                    <div className="caepi-norms">
                      <p className="caepi-norms__title">Normas / laudos</p>
                      <ul>
                        {caPreview.norms.map((norm) => (
                          <li key={norm.id}>
                            {[
                              norm.standard,
                              norm.reportNumber
                                ? `Laudo ${norm.reportNumber}`
                                : null,
                              norm.laboratoryName,
                            ]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={onApplyCaPreview}
                    >
                      Incluir dados no cadastro
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setCaPreview(null);
                        setCaAppliedBanner(null);
                      }}
                    >
                      Descartar previa
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="epi-form-section" aria-labelledby="sec-official">
              <div className="epi-form-section__head">
                <h3 id="sec-official">Dados oficiais do produto</h3>
                <p>
                  Campos alinhados aos dados oficiais do CA. Preencha pela busca
                  por nome ou pela busca por CA e revise antes de salvar.
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
                  <select
                    id="epi-color"
                    value={form.color}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, color: e.target.value }))
                    }
                  >
                    <option value="">Sem cor</option>
                    {mergeSelectOptions(EPI_COLOR_OPTIONS, form.color).map(
                      (option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ),
                    )}
                  </select>
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
                          <select
                            id={`v-size-${variant.key}`}
                            value={variant.size}
                            onChange={(e) =>
                              updateVariant(variant.key, {
                                size: e.target.value,
                              })
                            }
                          >
                            <option value="">Sem tamanho</option>
                            {mergeSelectOptions(
                              EPI_SIZE_OPTIONS,
                              variant.size,
                            ).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor={`v-color-${variant.key}`}>Cor</label>
                          <select
                            id={`v-color-${variant.key}`}
                            value={variant.color}
                            onChange={(e) =>
                              updateVariant(variant.key, {
                                color: e.target.value,
                              })
                            }
                          >
                            <option value="">Sem cor</option>
                            {mergeSelectOptions(
                              EPI_COLOR_OPTIONS,
                              variant.color,
                              form.color,
                            ).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor={`v-model-${variant.key}`}>Modelo</label>
                          <select
                            id={`v-model-${variant.key}`}
                            value={variant.model}
                            onChange={(e) =>
                              updateVariant(variant.key, {
                                model: e.target.value,
                              })
                            }
                          >
                            <option value="">Sem modelo</option>
                            {mergeSelectOptions(
                              form.reference ? [form.reference] : [],
                              variant.model,
                              form.reference,
                            ).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor={`v-side-${variant.key}`}>Lado</label>
                          <select
                            id={`v-side-${variant.key}`}
                            value={variant.side}
                            onChange={(e) =>
                              updateVariant(variant.key, {
                                side: e.target.value,
                              })
                            }
                          >
                            <option value="">Sem lado</option>
                            {mergeSelectOptions(
                              EPI_SIDE_OPTIONS,
                              variant.side,
                            ).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
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
                  <th scope="col">Estoque</th>
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
                    <td className="mono">
                      {stockTotalsByEpi[item.id] ?? 0}
                    </td>
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
