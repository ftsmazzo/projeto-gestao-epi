'use client';

import { FormEvent, useEffect, useState } from 'react';
import { fetchMe } from '../../../lib/auth';
import {
  createDistributorProduct,
  isDistributorManager,
  listDistributorProducts,
  lookupDistributorCa,
  updateDistributorMin,
  type DistributorProduct,
} from '../../../lib/distributor';

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

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const labels = variants
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const min = minQuantity.trim() === '' ? undefined : Number(minQuantity);
    if (min != null && (!Number.isInteger(min) || min < 0)) {
      setError('O minimo precisa ser um inteiro.');
      return;
    }
    setSaving(true);
    try {
      await createDistributorProduct({
        name,
        internalSku,
        supplierSku: supplierSku || undefined,
        caNumber: caNumber || undefined,
        minQuantity: min,
        variants: labels,
      });
      setName('');
      setInternalSku('');
      setSupplierSku('');
      setCaNumber('');
      setVariants('');
      setMinQuantity('');
      setNotice('Produto cadastrado.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cadastrar.');
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
            Cada produto tem codigo interno e variantes de tamanho ou numero.
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
              onChange={(e) => setInternalSku(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="fornecedor">Codigo do fornecedor</label>
            <input
              id="fornecedor"
              value={supplierSku}
              onChange={(e) => setSupplierSku(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="variantes">Variantes (separadas por virgula)</label>
            <input
              id="variantes"
              required
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
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Cadastrar produto'}
          </button>
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
              <th scope="col">Minimo</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
