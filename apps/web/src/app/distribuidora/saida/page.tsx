'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  listDistributorProducts,
  moveDistributorStock,
  type DistributorProduct,
} from '../../../lib/distributor';

export default function DistribuidoraSaidaPage() {
  const [products, setProducts] = useState<DistributorProduct[]>([]);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [lotCode, setLotCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listDistributorProducts()
      .then((rows) => {
        setProducts(rows);
        const first = rows[0]?.variants[0]?.id;
        if (first) setVariantId(first);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const amount = Number(quantity);
    if (!variantId || !Number.isInteger(amount) || amount < 1) {
      setError('Escolha o tamanho e uma quantidade inteira.');
      return;
    }
    setSaving(true);
    try {
      const result = await moveDistributorStock({
        variantId,
        direction: 'OUT',
        quantity: amount,
        lotCode: lotCode || undefined,
      });
      setNotice(
        `Saida registrada. Saldo de ${result.productName} ${result.label}: ${result.balance}${result.lotSummary ? `. Lote ${result.lotSummary}` : ''}.`,
      );
      const rows = await listDistributorProducts();
      setProducts(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na saida.');
    } finally {
      setSaving(false);
    }
  }

  const selectedProduct = products.find((product) =>
    product.variants.some((variant) => variant.id === variantId),
  );
  const selectedLots =
    selectedProduct?.variants.find((variant) => variant.id === variantId)?.lots.filter(
      (lot) => lot.quantity > 0,
    ) ?? [];
  const options = products.flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      label: `${product.name} · ${variant.label} (${variant.quantity})`,
    })),
  );

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Distribuidora</p>
          <h1 className="page-title">Saida</h1>
          <p className="page-lead">
            A saida so e aceita quando a quantidade cabe no saldo.
          </p>
        </div>
      </header>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="field-hint">{notice}</p> : null}
      <form className="form dash-panel" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="tamanho">Produto e tamanho</label>
          <select
            id="tamanho"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {selectedProduct?.tracksLot ? (
          <div className="field">
            <label htmlFor="lote">Lote</label>
            <select id="lote" value={lotCode} onChange={(e) => setLotCode(e.target.value)}>
              <option value="">O que vence primeiro</option>
              {selectedLots.map((lot) => (
                <option key={lot.id} value={lot.code}>
                  {lot.code} · {lot.quantity}
                  {lot.expiresOn ? ` · vence ${lot.expiresOn}` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="qtd">Quantidade</label>
          <input
            id="qtd"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving || options.length === 0}>
          Registrar saida
        </button>
      </form>
    </div>
  );
}
