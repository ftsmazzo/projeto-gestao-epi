'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  SizeChips,
  formatVariantConfirmLabel,
} from '../../../components/distributor/SizeChips';
import { DistributorScanPanel } from '../../../components/DistributorScanPanel';
import {
  listDistributorProducts,
  lookupDistributorProductByCode,
  moveDistributorStock,
  stockFinanceFollowUp,
  type DistributorProduct,
} from '../../../lib/distributor';

export default function DistribuidoraSaidaPage() {
  const [products, setProducts] = useState<DistributorProduct[]>([]);
  const [focusProductId, setFocusProductId] = useState('');
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
      .then((rows) => setProducts(rows))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
    scanRef.current?.focus();
  }, []);

  const focusProduct = useMemo(
    () => products.find((row) => row.id === focusProductId) ?? null,
    [products, focusProductId],
  );

  const selectedVariant = focusProduct?.variants.find((row) => row.id === variantId);
  const selectedLots =
    selectedVariant?.lots.filter((lot) => lot.quantity > 0) ?? [];
  const confirmLabel =
    focusProduct && selectedVariant
      ? formatVariantConfirmLabel(
          focusProduct.name,
          selectedVariant.label,
          quantity.trim() || '?',
        )
      : null;

  function selectFocusProduct(productId: string) {
    setFocusProductId(productId);
    setVariantId('');
    setLotCode('');
    setScannedLabel(null);
    const product = products.find((row) => row.id === productId);
    if (product && product.variants.length === 1) {
      setVariantId(product.variants[0]?.id ?? '');
    }
  }

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
      const multi = found.sizes.length > 1;
      const nextId = multi ? '' : found.preferredVariantId ?? found.sizes[0]?.id ?? '';
      setFocusProductId(found.product.id);
      setVariantId(nextId);
      setLotCode('');
      setScannedLabel(
        multi
          ? `${found.product.name} — toque no tamanho`
          : found.product.name,
      );
      setScanCode('');
      setQuantity('1');
      const balance =
        found.sizes.find((row) => row.id === nextId)?.quantity ??
        (multi ? null : found.sizes[0]?.quantity) ??
        null;
      setNotice(
        multi
          ? 'Código lido. Escolha o tamanho nos botões abaixo.'
          : balance != null && balance > 0
            ? `Código lido. Saldo disponível: ${balance}. Confira a quantidade.`
            : 'Código lido, mas este tamanho está zerado.',
      );
      window.setTimeout(() => {
        if (!multi) qtyRef.current?.focus();
      }, 50);
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
    if (!focusProductId) {
      setError('Escolha o produto (ou escaneie o código).');
      return;
    }
    if (!variantId) {
      setError('Toque no tamanho antes de confirmar.');
      return;
    }
    if (!Number.isInteger(amount) || amount < 1) {
      setError('Informe uma quantidade inteira maior que zero.');
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
        `Saída registrada. Saldo de ${result.productName} ${result.label}: ${result.balance}${result.lotSummary ? `. Lote ${result.lotSummary}` : ''}.${stockFinanceFollowUp(result, 'receber')}`,
      );
      const rows = await listDistributorProducts();
      setProducts(rows);
      setQuantity('1');
      setLotCode('');
      setVariantId('');
      setFocusProductId('');
      setScannedLabel(null);
      scanRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na saída.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Distribuidora</p>
          <h1 className="page-title">Saída</h1>
          <p className="page-lead">
            Escaneie o código, toque no tamanho e confirme. Só sai o que cabe no
            saldo.
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

      <form className="form dash-panel stock-confirm-form" onSubmit={onSubmit}>
        <h2 className="dash-panel__title">Confirmar saída</h2>
        <div className="form-grid">
          <div className="field field--span-2">
            <label htmlFor="produto-foco">Produto</label>
            <select
              id="produto-foco"
              value={focusProductId}
              onChange={(e) => selectFocusProduct(e.target.value)}
              required
            >
              <option value="">Selecione ou escaneie…</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.internalSku})
                </option>
              ))}
            </select>
          </div>

          {focusProduct ? (
            <div className="field field--span-2">
              <label>Tamanho</label>
              <SizeChips
                options={focusProduct.variants.map((variant) => ({
                  id: variant.id,
                  label: variant.label,
                  quantity: variant.quantity,
                }))}
                value={variantId}
                showBalance
                onChange={(id) => {
                  setVariantId(id);
                  setLotCode('');
                  window.setTimeout(() => qtyRef.current?.focus(), 30);
                }}
              />
              <p className="field-hint">
                Só os tamanhos deste produto. Toque no número certo antes de
                confirmar.
              </p>
            </div>
          ) : null}

          {focusProduct?.tracksLot ? (
            <div className="field field--span-2">
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

          <div className="field field--qty">
            <label htmlFor="qtd">Quantidade</label>
            <input
              ref={qtyRef}
              id="qtd"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        </div>

        {confirmLabel ? (
          <div className="stock-confirm-banner" role="status">
            <strong>Vai sair:</strong> {confirmLabel}
            {selectedVariant ? (
              <span className="muted"> · saldo {selectedVariant.quantity}</span>
            ) : null}
          </div>
        ) : (
          <p className="field-hint">
            Escaneie ou escolha o produto e toque no tamanho para confirmar a
            saída.
          </p>
        )}

        <div className="product-form__actions">
          <button
            className="btn btn-primary"
            type="submit"
            disabled={saving || !confirmLabel}
          >
            Confirmar saída
          </button>
        </div>
      </form>
    </div>
  );
}
