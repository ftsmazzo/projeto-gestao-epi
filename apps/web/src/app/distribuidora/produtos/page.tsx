'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { fetchMe } from '../../../lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  addDistributorVariant,
  createDistributorProduct,
  extractDistributorCatalogQuote,
  extractDistributorInvoice,
  getDistributorImportTemplate,
  importDistributorProductsCsv,
  isDistributorManager,
  listDistributorProducts,
  lookupDistributorCa,
  seedDistributorDemoCatalog,
  updateDistributorMin,
  updateDistributorProduct,
  type CatalogQuoteItem,
  type DistributorCatalogInput,
  type DistributorProduct,
} from '../../../lib/distributor';

const ORIGINS = [
  ['0', '0 — Nacional'],
  ['1', '1 — Estrangeira, importacao direta'],
  ['2', '2 — Estrangeira, adquirida no Brasil'],
  ['3', '3 — Nacional, conteudo importado acima de 40%'],
  ['4', '4 — Nacional, processos basicos'],
  ['5', '5 — Nacional, conteudo importado ate 40%'],
  ['6', '6 — Estrangeira, importacao direta, sem similar'],
  ['7', '7 — Estrangeira, mercado interno, sem similar'],
  ['8', '8 — Nacional, conteudo importado acima de 70%'],
] as const;

type Draft = {
  unitCode: string;
  itemsPerBox: string;
  gtin: string;
  warehouseLocation: string;
  costReais: string;
  saleReais: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  netKg: string;
  grossKg: string;
  boxLengthCm: string;
  boxWidthCm: string;
  boxHeightCm: string;
  ncm: string;
  cest: string;
  originCode: string;
  icmsSt: boolean;
  saleCfopIn: string;
  saleCfopOut: string;
  buyCfopIn: string;
  buyCfopOut: string;
  tracksLot: boolean;
};

const emptyDraft = (): Draft => ({
  unitCode: 'UN',
  itemsPerBox: '',
  gtin: '',
  warehouseLocation: '',
  costReais: '',
  saleReais: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  netKg: '',
  grossKg: '',
  boxLengthCm: '',
  boxWidthCm: '',
  boxHeightCm: '',
  ncm: '',
  cest: '',
  originCode: '0',
  icmsSt: false,
  saleCfopIn: '5102',
  saleCfopOut: '6102',
  buyCfopIn: '1102',
  buyCfopOut: '2102',
  tracksLot: false,
});

function showDecimal(value: number | null) {
  return value == null ? '' : String(value).replace('.', ',');
}

function showCents(cents: number | null) {
  return cents == null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

function draftFromProduct(product: DistributorProduct): Draft {
  return {
    unitCode: product.unitCode,
    itemsPerBox: product.itemsPerBox == null ? '' : String(product.itemsPerBox),
    gtin: product.gtin ?? '',
    warehouseLocation: product.warehouseLocation ?? '',
    costReais: showCents(product.costCents),
    saleReais: showCents(product.salePriceCents),
    lengthCm: showDecimal(product.lengthCm),
    widthCm: showDecimal(product.widthCm),
    heightCm: showDecimal(product.heightCm),
    netKg: showDecimal(product.netWeightKg),
    grossKg: showDecimal(product.grossWeightKg),
    boxLengthCm: showDecimal(product.boxLengthCm),
    boxWidthCm: showDecimal(product.boxWidthCm),
    boxHeightCm: showDecimal(product.boxHeightCm),
    ncm: product.ncm ?? '',
    cest: product.cest ?? '',
    originCode: String(product.originCode),
    icmsSt: product.icmsSt,
    saleCfopIn: product.saleCfopIn,
    saleCfopOut: product.saleCfopOut,
    buyCfopIn: product.buyCfopIn,
    buyCfopOut: product.buyCfopOut,
    tracksLot: product.tracksLot,
  };
}

function optionalDecimal(raw: string, label: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error(`${label} invalido.`);
  return value;
}

function optionalInt(raw: string, label: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isInteger(value)) throw new Error(`${label} invalido.`);
  return value;
}

function reaisToCents(raw: string, label = 'Valor'): number | null {
  const text = raw.trim().replace(',', '.');
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} inválido.`);
  return Math.round(value * 100);
}

function parseReais(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function formatReais(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function marginPercentFromPrices(costReais: string, saleReais: string): string {
  const cost = parseReais(costReais);
  const sale = parseReais(saleReais);
  if (cost == null || cost <= 0 || sale == null) return '';
  return formatReais(((sale - cost) / cost) * 100);
}

function saleFromMargin(costReais: string, marginPercent: string): string {
  const cost = parseReais(costReais);
  const margin = parseReais(marginPercent);
  if (cost == null || margin == null) return '';
  return formatReais(cost * (1 + margin / 100));
}

function catalogFromDraft(draft: Draft): DistributorCatalogInput {
  return {
    unitCode: draft.unitCode,
    itemsPerBox: optionalInt(draft.itemsPerBox, 'Itens por caixa'),
    gtin: draft.gtin.trim() || null,
    warehouseLocation: draft.warehouseLocation.trim() || null,
    costCents: reaisToCents(draft.costReais, 'Custo'),
    salePriceCents: reaisToCents(draft.saleReais, 'Preço de venda'),
    lengthCm: optionalDecimal(draft.lengthCm, 'Comprimento'),
    widthCm: optionalDecimal(draft.widthCm, 'Largura'),
    heightCm: optionalDecimal(draft.heightCm, 'Altura'),
    netWeightKg: optionalDecimal(draft.netKg, 'Peso liquido'),
    grossWeightKg: optionalDecimal(draft.grossKg, 'Peso bruto'),
    boxLengthCm: optionalDecimal(draft.boxLengthCm, 'Comprimento da caixa'),
    boxWidthCm: optionalDecimal(draft.boxWidthCm, 'Largura da caixa'),
    boxHeightCm: optionalDecimal(draft.boxHeightCm, 'Altura da caixa'),
    ncm: draft.ncm.trim() || null,
    cest: draft.cest.trim() || null,
    originCode: Number(draft.originCode),
    icmsSt: draft.icmsSt,
    saleCfopIn: draft.saleCfopIn.trim(),
    saleCfopOut: draft.saleCfopOut.trim(),
    buyCfopIn: draft.buyCfopIn.trim(),
    buyCfopOut: draft.buyCfopOut.trim(),
  };
}

function sizeName(label: string) {
  return label.trim() || 'Único';
}

export default function DistribuidoraProdutosPage() {
  const [products, setProducts] = useState<DistributorProduct[]>([]);
  const [manager, setManager] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [internalSku, setInternalSku] = useState('');
  const [supplierSku, setSupplierSku] = useState('');
  const [caNumber, setCaNumber] = useState('');
  const [variantRows, setVariantRows] = useState<string[]>(['Único']);
  const [newSize, setNewSize] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [depotOpen, setDepotOpen] = useState(false);
  const [fiscalOpen, setFiscalOpen] = useState(false);
  const [intakeMethod, setIntakeMethod] = useState<
    'individual' | 'csv' | 'arquivo'
  >('individual');
  const [marginPercent, setMarginPercent] = useState('');
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [quoteRows, setQuoteRows] = useState<
    Array<CatalogQuoteItem & { key: string; selected: boolean; internalSku: string }>
  >([]);
  const [quoteMeta, setQuoteMeta] = useState<{
    supplierName: string | null;
    message: string;
    warnings: string[];
  } | null>(null);
  const router = useRouter();

  async function reload() {
    const [rows, me] = await Promise.all([listDistributorProducts(), fetchMe()]);
    setProducts(rows);
    setManager(isDistributorManager(me.membershipRole));
  }

  useEffect(() => {
    void reload().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
    );
  }, []);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setName('');
    setInternalSku('');
    setSupplierSku('');
    setCaNumber('');
    setVariantRows(['Único']);
    setNewSize('');
    setMinQuantity('');
    setDraft(emptyDraft());
    setMarginPercent('');
    setEditingId(null);
    setFormOpen(false);
    setDepotOpen(false);
    setFiscalOpen(false);
  }

  function suggestInternalSku(fromName: string) {
    const slug = fromName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24);
    return slug || '';
  }

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    if (!needle) return products;
    return products.filter((product) => {
      const text = `${product.name} ${product.internalSku} ${product.gtin ?? ''} ${product.variants
        .map((variant) => variant.label)
        .join(' ')}`.toLocaleLowerCase('pt-BR');
      return text.includes(needle);
    });
  }, [products, query]);

  function moneyLabel(cents: number | null) {
    if (cents == null) return '—';
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  async function onArquivo(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);
    setQuoteRows([]);
    setQuoteMeta(null);
    const lower = file.name.toLowerCase();
    const isXml =
      lower.endsWith('.xml') ||
      file.type.includes('xml') ||
      file.type === 'text/xml';
    setExtracting(true);
    try {
      if (isXml) {
        const draft = await extractDistributorInvoice(file);
        setNotice(
          draft.message ||
            'NF-e lida. Abrindo a Entrada para vincular tamanhos e confirmar.',
        );
        router.push(`/distribuidora/entrada?doc=${encodeURIComponent(draft.id)}`);
        return;
      }
      const extracted = await extractDistributorCatalogQuote(file);
      const usedSkus = new Set(
        products.map((row) => row.internalSku.toLocaleLowerCase('pt-BR')),
      );
      const rows = extracted.items.map((item, index) => {
        let sku =
          item.supplierSku?.trim() ||
          suggestInternalSku(item.name) ||
          `ITEM-${index + 1}`;
        const base = sku;
        let n = 2;
        while (usedSkus.has(sku.toLocaleLowerCase('pt-BR'))) {
          sku = `${base}-${n}`;
          n += 1;
        }
        usedSkus.add(sku.toLocaleLowerCase('pt-BR'));
        return {
          ...item,
          key: `${index}-${sku}`,
          selected: true,
          internalSku: sku,
        };
      });
      setQuoteRows(rows);
      setQuoteMeta({
        supplierName: extracted.supplierName,
        message: extracted.message,
        warnings: extracted.warnings,
      });
      setNotice(extracted.message);
      if (extracted.warnings.length) {
        setError(extracted.warnings.slice(0, 3).join(' · '));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ler o arquivo.');
    } finally {
      setExtracting(false);
    }
  }

  async function onCreateFromQuote() {
    const selected = quoteRows.filter((row) => row.selected);
    if (selected.length === 0) {
      setError('Marque ao menos um item para cadastrar.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    let created = 0;
    const failures: string[] = [];
    for (const row of selected) {
      try {
        await createDistributorProduct({
          name: row.name,
          internalSku: row.internalSku,
          supplierSku: row.supplierSku ?? undefined,
          ncm: row.ncm ?? undefined,
          costCents: row.costCents ?? undefined,
          salePriceCents: row.salePriceCents ?? undefined,
          gtin: row.gtin,
          variants: row.sizes.length > 0 ? row.sizes : ['Único'],
        });
        created += 1;
      } catch (err) {
        failures.push(
          `${row.name}: ${err instanceof Error ? err.message : 'falhou'}`,
        );
      }
    }
    await reload();
    setSaving(false);
    if (created > 0) {
      setNotice(`${created} produto(s) cadastrados a partir do arquivo.`);
      setQuoteRows((current) => current.filter((row) => !row.selected));
    }
    if (failures.length) {
      setError(failures.slice(0, 4).join(' · '));
    }
  }

  async function onLookupCa() {
    setError(null);
    setNotice(null);
    try {
      const suggestion = await lookupDistributorCa(caNumber);
      if (!suggestion.found) {
        setNotice('CA nao esta na base. O cadastro segue manual.');
        return;
      }
      if (!name.trim() && suggestion.equipmentName) {
        setName(suggestion.equipmentName);
      }
      setNotice(
        `Sugestao: ${suggestion.equipmentName ?? 'sem nome'} · ${suggestion.manufacturerName ?? 'fabricante nao informado'}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar o CA.');
    }
  }

  function startEdit(product: DistributorProduct) {
    setError(null);
    setNotice(null);
    setEditingId(product.id);
    setName(product.name);
    setInternalSku(product.internalSku);
    setSupplierSku(product.supplierSku ?? '');
    setCaNumber(product.caNumber ?? '');
    setVariantRows(product.variants.map((variant) => sizeName(variant.label)));
    setFormOpen(true);
    setMinQuantity(product.minQuantity == null ? '' : String(product.minQuantity));
    const nextDraft = draftFromProduct(product);
    setDraft(nextDraft);
    setMarginPercent(
      marginPercentFromPrices(nextDraft.costReais, nextDraft.saleReais),
    );
    setIntakeMethod('individual');
    setDepotOpen(true);
    setFiscalOpen(Boolean(product.ncm || product.cest || product.icmsSt));
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const min = minQuantity.trim() === '' ? undefined : Number(minQuantity);
    if (min != null && (!Number.isInteger(min) || min < 0)) {
      setError('O minimo precisa ser um inteiro.');
      return;
    }
    let catalog: DistributorCatalogInput;
    try {
      catalog = catalogFromDraft(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ficha invalida.');
      return;
    }
    setSaving(true);
    try {
      const labels = variantRows.map((item) => item.trim()).filter(Boolean);
      if (editingId) {
        await updateDistributorProduct(editingId, {
          ...catalog,
          name,
          caNumber: caNumber || null,
          minQuantity: min ?? null,
          tracksLot: draft.tracksLot,
        });
        setNotice('Ficha atualizada.');
        setLastCreatedId(editingId);
      } else {
        const created = await createDistributorProduct({
          ...catalog,
          name,
          internalSku,
          supplierSku: supplierSku || undefined,
          caNumber: caNumber || undefined,
          minQuantity: min,
          variants: labels.length > 0 ? labels : ['Único'],
          tracksLot: draft.tracksLot,
        });
        setLastCreatedId(created.id);
        setNotice(
          catalog.gtin
            ? 'Produto cadastrado. Próximo passo: dar entrada no estoque (pode usar o leitor).'
            : 'Produto cadastrado. Complete o código de barras (GTIN) na ficha ou vá para Entrada com o SKU.',
        );
      }
      resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function onAddSize() {
    if (!editingId || !newSize.trim()) {
      setError('Informe o tamanho que falta.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addDistributorVariant(editingId, newSize.trim());
      setNewSize('');
      setNotice('Tamanho incluido.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao incluir o tamanho.');
    } finally {
      setSaving(false);
    }
  }

  async function onMin(product: DistributorProduct, value: string) {
    const min = value.trim() === '' ? null : Number(value);
    if (min != null && (!Number.isInteger(min) || min < 0)) return;
    setError(null);
    try {
      await updateDistributorMin(product.id, min);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar o minimo.');
    }
  }

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Distribuidora</p>
          <h1 className="page-title">Produtos</h1>
          <p className="page-lead">
            Cadastre um a um, por CSV ou pela NF-e na Entrada. Preço de custo,
            margem e venda ficam claros na ficha.
          </p>
        </div>
        {manager ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              resetForm();
              setIntakeMethod('individual');
              setFormOpen(true);
            }}
          >
            Novo produto
          </button>
        ) : null}
      </header>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="success" role="status" aria-live="polite">
          {notice}
        </p>
      ) : null}

      {manager ? (
        <section className="dash-panel intake-hub" aria-label="Como incluir produtos">
          <div className="dash-panel__head">
            <h2>Como incluir</h2>
          </div>
          <div className="intake-hub__body">
            <div className="intake-hub__grid" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={intakeMethod === 'individual'}
                className={`intake-hub__card${intakeMethod === 'individual' ? ' intake-hub__card--active' : ''}`}
                onClick={() => {
                  setIntakeMethod('individual');
                  setFormOpen(true);
                }}
              >
                <strong>Individual</strong>
                <span>Ficha com custo, margem e venda</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={intakeMethod === 'csv'}
                className={`intake-hub__card${intakeMethod === 'csv' ? ' intake-hub__card--active' : ''}`}
                onClick={() => {
                  setIntakeMethod('csv');
                  setFormOpen(false);
                }}
              >
                <strong>CSV</strong>
                <span>Muitos SKUs de uma vez</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={intakeMethod === 'arquivo'}
                className={`intake-hub__card${intakeMethod === 'arquivo' ? ' intake-hub__card--active' : ''}`}
                onClick={() => {
                  setIntakeMethod('arquivo');
                  setFormOpen(false);
                }}
              >
                <strong>XML / PDF / foto</strong>
                <span>NF-e, orçamento ou lista</span>
              </button>
            </div>

            {intakeMethod === 'arquivo' ? (
              <div className="intake-dropzone">
                <label className="intake-dropzone__label" htmlFor="arquivo-upload">
                  <strong>
                    {extracting
                      ? 'Lendo arquivo…'
                      : 'Solte ou escolha XML, PDF ou foto'}
                  </strong>
                  <span>
                    XML vai para a Entrada com impostos. PDF/foto usa Mistral
                    (OpenRouter) e monta a lista para você confirmar.
                  </span>
                </label>
                <input
                  id="arquivo-upload"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp,.xml,text/xml,application/xml"
                  disabled={extracting}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    void onArquivo(file);
                  }}
                />
              </div>
            ) : null}

            {quoteRows.length > 0 ? (
              <div className="quote-review">
                <div className="quote-review__head">
                  <h3>Itens lidos — confira antes de cadastrar</h3>
                  <p className="field-hint">
                    {quoteMeta?.supplierName
                      ? `Fornecedor: ${quoteMeta.supplierName}. `
                      : ''}
                    {quoteMeta?.message}
                  </p>
                </div>
                <ul className="catalog-card-list">
                  {quoteRows.map((row) => (
                    <li key={row.key} className="catalog-card">
                      <label className="catalog-card__check">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(event) =>
                            setQuoteRows((current) =>
                              current.map((item) =>
                                item.key === row.key
                                  ? { ...item, selected: event.target.checked }
                                  : item,
                              ),
                            )
                          }
                        />
                        <span>Incluir</span>
                      </label>
                      <div className="catalog-card__main">
                        <strong>{row.name}</strong>
                        <p className="muted">
                          SKU {row.internalSku}
                          {row.sizes.length
                            ? ` · ${row.sizes.join(', ')}`
                            : ''}
                        </p>
                        <p className="catalog-card__prices">
                          Custo {moneyLabel(row.costCents)} · Venda{' '}
                          {moneyLabel(row.salePriceCents)}
                          {row.quantity != null ? ` · Qtd ${row.quantity}` : ''}
                        </p>
                      </div>
                      <div className="field">
                        <label htmlFor={`sku-${row.key}`}>SKU interno</label>
                        <input
                          id={`sku-${row.key}`}
                          value={row.internalSku}
                          onChange={(event) =>
                            setQuoteRows((current) =>
                              current.map((item) =>
                                item.key === row.key
                                  ? { ...item, internalSku: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="product-form__actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saving}
                    onClick={() => void onCreateFromQuote()}
                  >
                    {saving ? 'Cadastrando…' : 'Cadastrar selecionados'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setQuoteRows([]);
                      setQuoteMeta(null);
                    }}
                  >
                    Limpar leitura
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {manager && formOpen && intakeMethod === 'individual' ? (
        <form className="form dash-panel product-form" onSubmit={onCreate}>
          <h2 className="dash-panel__title">
            {editingId ? 'Editar ficha' : 'Novo produto'}
          </h2>
          <p className="field-hint">
            Campos com * são o mínimo para estoque. Custo, margem e venda
            ficam sempre visíveis para montar a tabela.
          </p>

          <fieldset className="product-form__section">
            <legend className="product-form__legend">Essencial</legend>
            <div className="form-grid">
              <div className="field field--span-2">
                <label htmlFor="ca">CA (opcional)</label>
                <div className="product-form__inline">
                  <input
                    id="ca"
                    value={caNumber}
                    onChange={(e) => setCaNumber(e.target.value)}
                    placeholder="Só números"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onLookupCa}
                  >
                    Consultar CA
                  </button>
                </div>
                <p className="field-hint">
                  Se achar na base, sugere o nome. Se não achar, o cadastro segue.
                </p>
              </div>
              <div className="field">
                <label htmlFor="nome">Nome *</label>
                <input
                  id="nome"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => {
                    const next = e.target.value;
                    setName(next);
                    if (!editingId && !internalSku.trim()) {
                      setInternalSku(suggestInternalSku(next));
                    }
                  }}
                  placeholder="Ex.: Luva nitrílica"
                />
              </div>
              <div className="field">
                <label htmlFor="sku">Código interno *</label>
                <input
                  id="sku"
                  required
                  value={internalSku}
                  disabled={editingId != null}
                  onChange={(e) => setInternalSku(e.target.value)}
                  placeholder="SKU da casa"
                />
              </div>
              <div className="field">
                <label htmlFor="fornecedor">Código do fornecedor</label>
                <input
                  id="fornecedor"
                  value={supplierSku}
                  disabled={editingId != null}
                  onChange={(e) => setSupplierSku(e.target.value)}
                  placeholder="Como vem na nota de compra"
                />
              </div>
              <div className="field">
                <label htmlFor="unidade">Unidade</label>
                <select
                  id="unidade"
                  value={draft.unitCode}
                  onChange={(e) => setField('unitCode', e.target.value)}
                >
                  <option value="UN">UN — unidade</option>
                  <option value="PAR">PAR — par</option>
                  <option value="CX">CX — caixa</option>
                </select>
              </div>
              <div className="field field--span-2">
                <label>Tamanhos *</label>
                <p className="field-hint">
                  Sem numeração, deixe Único. Cada tamanho vira uma linha no saldo.
                </p>
                <div className="product-form__sizes">
                  {variantRows.map((row, index) => (
                    <input
                      key={index}
                      aria-label={`Tamanho ${index + 1}`}
                      value={row}
                      disabled={editingId != null}
                      placeholder="Único, 40, M…"
                      onChange={(event) =>
                        setVariantRows((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                    />
                  ))}
                </div>
                {editingId ? (
                  <div className="product-form__inline">
                    <input
                      aria-label="Novo tamanho"
                      value={newSize}
                      placeholder="Novo tamanho"
                      onChange={(event) => setNewSize(event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void onAddSize()}
                    >
                      Incluir tamanho
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setVariantRows((current) => [...current, ''])}
                  >
                    Adicionar tamanho
                  </button>
                )}
              </div>
              <div className="field">
                <label htmlFor="gtin-essencial">Código de barras (GTIN / EAN)</label>
                <input
                  id="gtin-essencial"
                  value={draft.gtin}
                  onChange={(e) => setField('gtin', e.target.value)}
                  placeholder="Escaneie ou digite 8–14 dígitos"
                />
                <p className="field-hint">
                  Depois do cadastro, a Entrada usa este código no leitor USB.
                </p>
              </div>
              <div className="field">
                <label htmlFor="minimo">Estoque mínimo</label>
                <input
                  id="minimo"
                  inputMode="numeric"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="field field--span-2">
                <label htmlFor="lote" className="product-form__check">
                  <input
                    id="lote"
                    type="checkbox"
                    checked={draft.tracksLot}
                    onChange={(e) => setField('tracksLot', e.target.checked)}
                  />
                  Controla lote e validade (FEFO)
                </label>
              </div>
            </div>
          </fieldset>

          <fieldset className="product-form__section product-form__pricing">
            <legend className="product-form__legend">Preço de tabela</legend>
            <p className="field-hint">
              Custo âncora a margem; venda é o teto do orçamento/visita. Desconto
              comercial se aplica na venda, não no custo.
            </p>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="custo">Custo (R$)</label>
                <input
                  id="custo"
                  inputMode="decimal"
                  value={draft.costReais}
                  onChange={(e) => {
                    const costReais = e.target.value;
                    setDraft((current) => {
                      const next = { ...current, costReais };
                      if (marginPercent.trim()) {
                        next.saleReais = saleFromMargin(costReais, marginPercent);
                      }
                      return next;
                    });
                  }}
                  placeholder="0,00"
                />
              </div>
              <div className="field">
                <label htmlFor="margem">Margem (%)</label>
                <input
                  id="margem"
                  inputMode="decimal"
                  value={marginPercent}
                  onChange={(e) => {
                    const nextMargin = e.target.value;
                    setMarginPercent(nextMargin);
                    setDraft((current) => ({
                      ...current,
                      saleReais: saleFromMargin(current.costReais, nextMargin),
                    }));
                  }}
                  placeholder="Ex.: 40"
                />
                <p className="field-hint">
                  Ajuste aqui para dar desconto na tabela sem perder o custo.
                </p>
              </div>
              <div className="field">
                <label htmlFor="venda">Preço de venda (R$)</label>
                <input
                  id="venda"
                  inputMode="decimal"
                  value={draft.saleReais}
                  onChange={(e) => {
                    const saleReais = e.target.value;
                    setDraft((current) => ({ ...current, saleReais }));
                    setMarginPercent(
                      marginPercentFromPrices(draft.costReais, saleReais),
                    );
                  }}
                  placeholder="0,00"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="product-form__section">
            <legend className="product-form__legend">
              <button
                type="button"
                className="product-form__toggle"
                aria-expanded={depotOpen}
                onClick={() => setDepotOpen((open) => !open)}
              >
                {depotOpen ? '▾' : '▸'} Depósito e medidas
                <span className="product-form__optional">opcional</span>
              </button>
            </legend>
            {depotOpen ? (
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="local">Endereço no depósito</label>
                  <input
                    id="local"
                    value={draft.warehouseLocation}
                    onChange={(e) => setField('warehouseLocation', e.target.value)}
                    placeholder="Ex.: A-12"
                  />
                </div>
                <div className="field">
                  <label htmlFor="caixa">Itens por caixa</label>
                  <input
                    id="caixa"
                    inputMode="numeric"
                    value={draft.itemsPerBox}
                    onChange={(e) => setField('itemsPerBox', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="comp">Comprimento (cm)</label>
                  <input
                    id="comp"
                    inputMode="decimal"
                    value={draft.lengthCm}
                    onChange={(e) => setField('lengthCm', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="larg">Largura (cm)</label>
                  <input
                    id="larg"
                    inputMode="decimal"
                    value={draft.widthCm}
                    onChange={(e) => setField('widthCm', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="alt">Altura (cm)</label>
                  <input
                    id="alt"
                    inputMode="decimal"
                    value={draft.heightCm}
                    onChange={(e) => setField('heightCm', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="pliq">Peso líquido (kg)</label>
                  <input
                    id="pliq"
                    inputMode="decimal"
                    value={draft.netKg}
                    onChange={(e) => setField('netKg', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="pbruto">Peso bruto (kg)</label>
                  <input
                    id="pbruto"
                    inputMode="decimal"
                    value={draft.grossKg}
                    onChange={(e) => setField('grossKg', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ccomp">Caixa — comprimento (cm)</label>
                  <input
                    id="ccomp"
                    inputMode="decimal"
                    value={draft.boxLengthCm}
                    onChange={(e) => setField('boxLengthCm', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="clarg">Caixa — largura (cm)</label>
                  <input
                    id="clarg"
                    inputMode="decimal"
                    value={draft.boxWidthCm}
                    onChange={(e) => setField('boxWidthCm', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="calt">Caixa — altura (cm)</label>
                  <input
                    id="calt"
                    inputMode="decimal"
                    value={draft.boxHeightCm}
                    onChange={(e) => setField('boxHeightCm', e.target.value)}
                  />
                </div>
                <p className="field-hint field--span-2">
                  Cubagem = C × L × A. Peso cubado usa divisor 6000.
                </p>
              </div>
            ) : null}
          </fieldset>

          <fieldset className="product-form__section">
            <legend className="product-form__legend">
              <button
                type="button"
                className="product-form__toggle"
                aria-expanded={fiscalOpen}
                onClick={() => setFiscalOpen((open) => !open)}
              >
                {fiscalOpen ? '▾' : '▸'} Fiscal
                <span className="product-form__optional">opcional no piloto</span>
              </button>
            </legend>
            {fiscalOpen ? (
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="ncm">NCM</label>
                  <input
                    id="ncm"
                    value={draft.ncm}
                    onChange={(e) => setField('ncm', e.target.value)}
                    placeholder="8 dígitos"
                  />
                </div>
                <div className="field">
                  <label htmlFor="cest">CEST</label>
                  <input
                    id="cest"
                    value={draft.cest}
                    onChange={(e) => setField('cest', e.target.value)}
                    placeholder="7 dígitos, se houver ST"
                  />
                </div>
                <div className="field">
                  <label htmlFor="origem">Origem</label>
                  <select
                    id="origem"
                    value={draft.originCode}
                    onChange={(e) => setField('originCode', e.target.value)}
                  >
                    {ORIGINS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="st" className="product-form__check">
                    <input
                      id="st"
                      type="checkbox"
                      checked={draft.icmsSt}
                      onChange={(e) => setField('icmsSt', e.target.checked)}
                    />
                    Substituição tributária
                  </label>
                </div>
                <div className="field">
                  <label htmlFor="cfop-venda">CFOP venda interna</label>
                  <input
                    id="cfop-venda"
                    value={draft.saleCfopIn}
                    onChange={(e) => setField('saleCfopIn', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="cfop-venda-fora">CFOP venda interestadual</label>
                  <input
                    id="cfop-venda-fora"
                    value={draft.saleCfopOut}
                    onChange={(e) => setField('saleCfopOut', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="cfop-compra">CFOP compra interna</label>
                  <input
                    id="cfop-compra"
                    value={draft.buyCfopIn}
                    onChange={(e) => setField('buyCfopIn', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="cfop-compra-fora">CFOP compra interestadual</label>
                  <input
                    id="cfop-compra-fora"
                    value={draft.buyCfopOut}
                    onChange={(e) => setField('buyCfopOut', e.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </fieldset>

          <div className="product-form__actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving
                ? 'Salvando…'
                : editingId
                  ? 'Salvar ficha'
                  : 'Cadastrar e seguir'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={resetForm}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {lastCreatedId ? (
        <section className="dash-panel product-form__next">
          <h2 className="dash-panel__title">Próximos passos</h2>
          <ol className="product-form__steps">
            <li>
              Se ainda não tem GTIN, abra a ficha e cole o código de barras do
              produto.
            </li>
            <li>
              Vá em <Link href="/distribuidora/entrada">Entrada</Link>, escaneie
              o código (ou digite o SKU) e registre a quantidade.
            </li>
            <li>
              Confira o saldo em <Link href="/distribuidora/saldo">Saldo</Link>.
            </li>
          </ol>
        </section>
      ) : null}

      {manager ? (
        <section className="dash-panel">
          <h2 className="dash-panel__title">Para testar rápido</h2>
          <p className="field-hint">
            Carrega 10 EPIs com GTIN, tamanhos e saldo inicial. SKUs que já
            existem são ignorados.
          </p>
          <div className="product-form__actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={seeding}
              onClick={() => {
                setError(null);
                setNotice(null);
                setSeeding(true);
                void seedDistributorDemoCatalog()
                  .then(async (result) => {
                    setNotice(
                      result.createdCount > 0
                        ? `${result.createdCount} produtos demo criados com saldo. ${result.hint}`
                        : `Nada novo: os SKUs demo já estavam cadastrados. ${result.hint}`,
                    );
                    await reload();
                  })
                  .catch((err: unknown) =>
                    setError(
                      err instanceof Error
                        ? err.message
                        : 'Falha ao gerar o catálogo demo.',
                    ),
                  )
                  .finally(() => setSeeding(false));
              }}
            >
              {seeding ? 'Gerando…' : 'Gerar catálogo demo (10 EPIs)'}
            </button>
          </div>
        </section>
      ) : null}

      {manager && intakeMethod === 'csv' ? (
        <section className="dash-panel">
          <h2 className="dash-panel__title">Carga em lote (CSV)</h2>
          <p className="field-hint">
            Colunas: nome, codigo_interno, tamanhos (P|M|G ou Unico), gtin,
            unidade, ncm, minimo, custo, preco_venda, controla_lote. Separador ;
            ou ,.
          </p>
          <div className="product-form__actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void getDistributorImportTemplate()
                  .then((tpl) => {
                    const blob = new Blob([tpl.csv], {
                      type: 'text/csv;charset=utf-8',
                    });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = tpl.fileName;
                    anchor.click();
                    URL.revokeObjectURL(url);
                  })
                  .catch((err: unknown) =>
                    setError(
                      err instanceof Error
                        ? err.message
                        : 'Falha ao baixar o modelo.',
                    ),
                  );
              }}
            >
              Baixar modelo CSV
            </button>
            <label className="btn btn-primary" htmlFor="csv-upload">
              {importing ? 'Importando…' : 'Enviar CSV'}
            </label>
            <input
              id="csv-upload"
              type="file"
              accept=".csv,text/csv"
              hidden
              disabled={importing}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                setError(null);
                setNotice(null);
                setImporting(true);
                void file
                  .text()
                  .then((text) => importDistributorProductsCsv(text))
                  .then(async (result) => {
                    setNotice(
                      `${result.createdCount} produto(s) criados` +
                        (result.skippedCount
                          ? ` · ${result.skippedCount} linha(s) ignoradas`
                          : '') +
                        '.',
                    );
                    if (result.skipped.length > 0) {
                      setError(result.skipped.slice(0, 5).join(' '));
                    }
                    await reload();
                  })
                  .catch((err: unknown) =>
                    setError(
                      err instanceof Error
                        ? err.message
                        : 'Falha na importação.',
                    ),
                  )
                  .finally(() => setImporting(false));
              }}
            />
          </div>
        </section>
      ) : null}

      <section className="dash-panel catalog-section">
        <div className="dash-panel__head">
          <h2>Catálogo</h2>
        </div>
        <div className="catalog-section__body">
          <div className="field">
            <label htmlFor="busca-produto">Buscar</label>
            <input
              id="busca-produto"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome, código, GTIN ou tamanho"
            />
          </div>
          {products.length === 0 ? (
            <div className="empty-state">
              <p className="page-lead">
                Catálogo vazio. Cadastre individualmente, por CSV ou mande XML/PDF/foto.
              </p>
              <ol className="product-form__steps">
                <li>
                  {manager
                    ? 'Use “Como incluir” acima ou gere o catálogo demo.'
                    : 'Peça ao gestor para cadastrar o primeiro produto.'}
                </li>
                <li>
                  Depois dê entrada em{' '}
                  <Link href="/distribuidora/entrada">Entrada</Link>.
                </li>
              </ol>
            </div>
          ) : (
            <ul className="catalog-card-list">
              {filteredProducts.map((product) => {
                const balance = product.variants.reduce(
                  (sum, variant) => sum + variant.quantity,
                  0,
                );
                return (
                  <li key={product.id} className="catalog-card">
                    <div className="catalog-card__main">
                      <strong>{product.name}</strong>
                      <p className="muted">
                        {product.internalSku}
                        {product.gtin ? ` · GTIN ${product.gtin}` : ' · sem GTIN'}
                        {product.caNumber ? ` · CA ${product.caNumber}` : ''}
                        {` · ${product.unitCode}`}
                      </p>
                      <div className="catalog-card__sizes" aria-label="Tamanhos">
                        {product.variants.map((variant) => (
                          <span key={variant.id} className="catalog-size-pill">
                            {sizeName(variant.label) === 'Único'
                              ? 'Único'
                              : sizeName(variant.label)}{' '}
                            <em>{variant.quantity}</em>
                          </span>
                        ))}
                      </div>
                      <p className="catalog-card__prices">
                        Custo {moneyLabel(product.costCents)} · Venda{' '}
                        {moneyLabel(product.salePriceCents)} · Saldo {balance}
                      </p>
                    </div>
                    <div className="catalog-card__side">
                      {manager ? (
                        <>
                          <div className="field">
                            <label htmlFor={`min-${product.id}`}>Mínimo</label>
                            <input
                              id={`min-${product.id}`}
                              defaultValue={product.minQuantity ?? ''}
                              inputMode="numeric"
                              onBlur={(event) =>
                                onMin(product, event.target.value)
                              }
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => startEdit(product)}
                          >
                            Abrir ficha
                          </button>
                        </>
                      ) : (
                        <p className="muted">
                          Mín. {product.minQuantity ?? '—'}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {products.length > 0 && filteredProducts.length === 0 ? (
            <p className="muted">Nenhum produto com esse filtro.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
