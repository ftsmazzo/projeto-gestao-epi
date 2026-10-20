'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { DistributorScanPanel } from '../../../components/DistributorScanPanel';
import {
  listDistributorProducts,
  lookupDistributorProductByCode,
  moveDistributorStock,
  type DistributorProduct,
} from '../../../lib/distributor';

export default function DistribuidoraSaidaPage() {
  const [products, setProducts] = useState<DistributorProduct[]>([]);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [lotCode, setLotCode] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [scannedLabel, setScannedLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

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
    scanRef.current?.focus();
  }, []);

  async function resolveScan(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError(null);
    setNotice(null);
    try {
      const found = await lookupDistributorProductByCode(trimmed);
      setProducts((current) => {
        const others = current.filter((row) => row.id !== found.product.id);
        return [found.product, ...others];
      });
      const nextId = found.preferredVariantId ?? found.sizes[0]?.id ?? '';
      setVariantId(nextId);
      setLotCode('');
      setScannedLabel(
        `${found.product.name}${found.sizes.length > 1 ? ' — escolha o tamanho abaixo' : ''}`,
      );
      setScanCode('');
      setQuantity('1');
      const balance =
        found.sizes.find((row) => row.id === nextId)?.quantity ??
        found.sizes[0]?.quantity ??
        0;
      setNotice(
        balance > 0
          ? `Código lido. Saldo disponível: ${balance}. Confira a quantidade.`
          : 'Código lido, mas este tamanho está zerado.',
      );
      window.setTimeout(() => qtyRef.current?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código não encontrado.');
      setScanCode('');
      scanRef.current?.focus();
    }
  }

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
        `Saída registrada. Saldo de ${result.productName} ${result.label}: ${result.balance}${result.lotSummary ? `. Lote ${result.lotSummary}` : ''}.`,
      );
      const rows = await listDistributorProducts();
      setProducts(rows);
      setQuantity('1');
      setLotCode('');
      setScannedLabel(null);
      scanRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na saída.');
    } finally {
      setSaving(false);
    }
  }

  const selectedProduct = products.find((product) =>
    product.variants.some((variant) => variant.id === variantId),
  );
  const selectedLots =
    selectedProduct?.variants
      .find((variant) => variant.id === variantId)
      ?.lots.filter((lot) => lot.quantity > 0) ?? [];
  const options = products.flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      label: `${product.name} · ${
        variant.label === 'Único' || variant.label === 'Unico'
          ? 'sem numeração'
          : variant.label
      } (${variant.quantity})`,
    })),
  );

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Distribuidora</p>
          <h1 className="page-title">Saída</h1>
          <p className="page-lead">
            Escaneie o código, confira o tamanho e a quantidade. Só sai o que
            cabe no saldo.
          </p>
        </div>
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

      <DistributorScanPanel
        inputId="scan-out"
        inputRef={scanRef}
        value={scanCode}
        onChange={setScanCode}
        onResolve={resolveScan}
        scannedLabel={scannedLabel}
        products={products}
        mode="saida"
      />

      <form className="form dash-panel" onSubmit={onSubmit}>
        <h2 className="dash-panel__title">Confirmar saída</h2>
        <div className="field">
          <label htmlFor="tamanho">Produto e tamanho</label>
          <select
            id="tamanho"
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              setLotCode('');
            }}
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
            <select
              id="lote"
              value={lotCode}
              onChange={(e) => setLotCode(e.target.value)}
            >
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
            ref={qtyRef}
            id="qtd"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={saving || options.length === 0}
        >
          Registrar saída
        </button>
      </form>
    </div>
  );
}
