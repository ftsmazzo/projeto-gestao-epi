'use client';

import { FormEvent, useEffect, useState } from 'react';
import { fetchMe } from '../../../lib/auth';
import {
  createDistributorProduct,
  isDistributorManager,
  listDistributorProducts,
  lookupDistributorCa,
  updateDistributorMin,
  updateDistributorProduct,
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

function reaisToCents(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) throw new Error('Custo invalido.');
  return Math.round(value * 100);
}

function catalogFromDraft(draft: Draft): DistributorCatalogInput {
  return {
    unitCode: draft.unitCode,
    itemsPerBox: optionalInt(draft.itemsPerBox, 'Itens por caixa'),
    gtin: draft.gtin.trim() || null,
    warehouseLocation: draft.warehouseLocation.trim() || null,
    costCents: reaisToCents(draft.costReais),
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

function formatM3(value: number | null) {
  if (value == null) return '—';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} m3`;
}

function formatKg(grams: number | null) {
  if (grams == null) return '—';
  return `${(grams / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`;
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
  const [variants, setVariants] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    setVariants('');
    setMinQuantity('');
    setDraft(emptyDraft());
    setEditingId(null);
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
    setVariants(product.variants.map((variant) => variant.label).join(', '));
    setMinQuantity(product.minQuantity == null ? '' : String(product.minQuantity));
    setDraft(draftFromProduct(product));
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
      if (editingId) {
        await updateDistributorProduct(editingId, {
          ...catalog,
          name,
          caNumber: caNumber || null,
          minQuantity: min ?? null,
          tracksLot: draft.tracksLot,
        });
        setNotice('Ficha atualizada.');
      } else {
        const labels = variants
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        await createDistributorProduct({
          ...catalog,
          name,
          internalSku,
          supplierSku: supplierSku || undefined,
          caNumber: caNumber || undefined,
          minQuantity: min,
          variants: labels,
          tracksLot: draft.tracksLot,
        });
        setNotice('Produto cadastrado.');
      }
      resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
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
            Cada produto tem codigo interno, variantes e a ficha de cubagem.
            O regime padrao da revenda e Lucro Presumido, com CFOP 5102 e 6102.
            O CA so sugere o nome.
          </p>
        </div>
      </header>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="field-hint">{notice}</p> : null}
      {manager ? (
        <form className="form dash-panel" onSubmit={onCreate}>
          <h2 className="dash-panel__title">
            {editingId ? 'Editar ficha' : 'Novo produto'}
          </h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="ca">CA (opcional)</label>
              <input
                id="ca"
                value={caNumber}
                onChange={(e) => setCaNumber(e.target.value)}
              />
              <button type="button" className="btn btn-secondary" onClick={onLookupCa}>
                Consultar CA
              </button>
            </div>
            <div className="field">
              <label htmlFor="nome">Nome</label>
              <input
                id="nome"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sku">Codigo interno</label>
              <input
                id="sku"
                required
                value={internalSku}
                disabled={editingId != null}
                onChange={(e) => setInternalSku(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="fornecedor">Codigo do fornecedor</label>
              <input
                id="fornecedor"
                value={supplierSku}
                disabled={editingId != null}
                onChange={(e) => setSupplierSku(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="variantes">Variantes (separadas por virgula)</label>
              <input
                id="variantes"
                required={!editingId}
                disabled={editingId != null}
                value={variants}
                onChange={(e) => setVariants(e.target.value)}
                placeholder="P, M, G"
              />
            </div>
            <div className="field">
              <label htmlFor="minimo">Minimo (opcional)</label>
              <input
                id="minimo"
                inputMode="numeric"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="unidade">Unidade</label>
              <select
                id="unidade"
                value={draft.unitCode}
                onChange={(e) => setField('unitCode', e.target.value)}
              >
                <option value="UN">UN</option>
                <option value="PAR">PAR</option>
                <option value="CX">CX</option>
              </select>
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
              <label htmlFor="gtin">GTIN / EAN</label>
              <input
                id="gtin"
                value={draft.gtin}
                onChange={(e) => setField('gtin', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="local">Endereco no deposito</label>
              <input
                id="local"
                value={draft.warehouseLocation}
                onChange={(e) => setField('warehouseLocation', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="custo">Custo (R$)</label>
              <input
                id="custo"
                inputMode="decimal"
                value={draft.costReais}
                onChange={(e) => setField('costReais', e.target.value)}
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
              <label htmlFor="pliq">Peso liquido (kg)</label>
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
            <div className="field">
              <label htmlFor="ncm">NCM</label>
              <input
                id="ncm"
                value={draft.ncm}
                onChange={(e) => setField('ncm', e.target.value)}
                placeholder="8 digitos"
              />
            </div>
            <div className="field">
              <label htmlFor="cest">CEST</label>
              <input
                id="cest"
                value={draft.cest}
                onChange={(e) => setField('cest', e.target.value)}
                placeholder="7 digitos, se houver ST"
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
              <label htmlFor="lote">Controla lote e validade</label>
              <input
                id="lote"
                type="checkbox"
                checked={draft.tracksLot}
                onChange={(e) => setField('tracksLot', e.target.checked)}
              />
            </div>
            <div className="field">
              <label htmlFor="st">Substituicao tributaria</label>
              <input
                id="st"
                type="checkbox"
                checked={draft.icmsSt}
                onChange={(e) => setField('icmsSt', e.target.checked)}
              />
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
          <p className="field-hint">
            Cubagem em m3 = C x L x A. Peso cubado usa o divisor 6000. EPI comum
            nasce sem substituicao tributaria.
          </p>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : editingId ? 'Salvar ficha' : 'Cadastrar produto'}
          </button>
          {editingId ? (
            <button type="button" className="btn btn-secondary" onClick={resetForm}>
              Cancelar
            </button>
          ) : null}
        </form>
      ) : (
        <p className="field-hint">O cadastro de produto e do gestor.</p>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Produto</th>
              <th scope="col">Codigo</th>
              <th scope="col">Variantes</th>
              <th scope="col">Cubagem</th>
              <th scope="col">Peso cubado</th>
              <th scope="col">Fiscal</th>
              <th scope="col">Minimo</th>
              {manager ? <th scope="col">Ficha</th> : null}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  {product.name}
                  {product.caNumber ? (
                    <span className="table-sub">CA {product.caNumber}</span>
                  ) : null}
                </td>
                <td>{product.internalSku}</td>
                <td>
                  {product.variants
                    .map((variant) => `${variant.label} (${variant.quantity})`)
                    .join(', ')}
                </td>
                <td>
                  {formatM3(product.boxCubageM3 ?? product.itemCubageM3)}
                  {product.boxCubageM3 != null || product.itemCubageM3 != null ? (
                    <span className="table-sub">
                      {product.boxCubageM3 != null ? 'caixa' : 'item'}
                    </span>
                  ) : null}
                </td>
                <td>
                  {formatKg(product.boxVolumetricWeightG ?? product.itemVolumetricWeightG)}
                </td>
                <td>
                  {product.ncm ?? 'sem NCM'}
                  <span className="table-sub">
                    {product.saleCfopIn}/{product.saleCfopOut}
                    {product.icmsSt ? ' · ST' : ''}
                  </span>
                </td>
                <td>
                  {manager ? (
                    <input
                      aria-label={`Minimo de ${product.name}`}
                      defaultValue={product.minQuantity ?? ''}
                      inputMode="numeric"
                      onBlur={(e) => onMin(product, e.target.value)}
                    />
                  ) : (
                    (product.minQuantity ?? '—')
                  )}
                </td>
                {manager ? (
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => startEdit(product)}
                    >
                      Editar
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
