'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { PartyPicker } from '../../../components/distributor/PartyPicker';
import {
  SizeChips,
  formatVariantConfirmLabel,
} from '../../../components/distributor/SizeChips';
import { DistributorScanPanel } from '../../../components/DistributorScanPanel';
import {
  confirmDistributorInbound,
  createDistributorProduct,
  createSupplier,
  discardDistributorInbound,
  extractDistributorInvoice,
  linkDistributorLine,
  linkInboundSupplier,
  listDistributorProducts,
  listSuppliers,
  lookupDistributorProductByCode,
  moveDistributorStock,
  stockFinanceFollowUp,
  type DistributorInboundDocument,
  type DistributorInboundLine,
  type DistributorProduct,
  type DistributorSupplier,
} from '../../../lib/distributor';

function money(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function lineTaxHint(line: DistributorInboundLine) {
  if (!line.tax) return null;
  const parts = [
    line.tax.icmsCents ? `ICMS ${money(line.tax.icmsCents)}` : null,
    line.tax.icmsStCents ? `ST ${money(line.tax.icmsStCents)}` : null,
    line.tax.ipiCents ? `IPI ${money(line.tax.ipiCents)}` : null,
    line.tax.pisCents ? `PIS ${money(line.tax.pisCents)}` : null,
    line.tax.cofinsCents ? `COFINS ${money(line.tax.cofinsCents)}` : null,
    line.tax.freightCents ? `Frete ${money(line.tax.freightCents)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function productOfVariant(
  products: DistributorProduct[],
  variantId: string | null | undefined,
) {
  if (!variantId) return null;
  return (
    products.find((product) =>
      product.variants.some((variant) => variant.id === variantId),
    ) ?? null
  );
}

export default function DistribuidoraEntradaPage() {
  const [products, setProducts] = useState<DistributorProduct[]>([]);
  const [suppliers, setSuppliers] = useState<DistributorSupplier[]>([]);
  const [focusProductId, setFocusProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [lotCode, setLotCode] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [scannedLabel, setScannedLabel] = useState<string | null>(null);
  const [document, setDocument] = useState<DistributorInboundDocument | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [manualSupplierId, setManualSupplierId] = useState('');
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newSizes, setNewSizes] = useState('Único');
  const [newNcm, setNewNcm] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newSale, setNewSale] = useState('');
  const [createForLineId, setCreateForLineId] = useState<string | null>(null);
  const [lineProductIds, setLineProductIds] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.all([listDistributorProducts(), listSuppliers()])
      .then(([rows, supplierRows]) => {
        setProducts(rows);
        setSuppliers(supplierRows);
      })
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
  const confirmLabel =
    focusProduct && selectedVariant
      ? formatVariantConfirmLabel(
          focusProduct.name,
          selectedVariant.label,
          quantity.trim() || '?',
        )
      : null;

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
      setScannedLabel(
        multi
          ? `${found.product.name} — toque no tamanho`
          : found.product.name,
      );
      setScanCode('');
      setQuantity('1');
      setNotice(
        multi
          ? 'Código lido. Escolha o tamanho nos botões abaixo antes de confirmar.'
          : found.product.gtin
            ? 'Código lido. Confira a quantidade e confirme a entrada.'
            : 'Produto encontrado pelo SKU. Vale cadastrar o GTIN na ficha para o leitor.',
      );
      window.setTimeout(() => qtyRef.current?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código não encontrado.');
      setScanCode('');
      scanRef.current?.focus();
    }
  }

  function selectFocusProduct(productId: string) {
    setFocusProductId(productId);
    setVariantId('');
    setScannedLabel(null);
    const product = products.find((row) => row.id === productId);
    if (product && product.variants.length === 1) {
      setVariantId(product.variants[0]?.id ?? '');
    }
  }

  async function onManual(event: FormEvent) {
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
    if (!confirmLabel) {
      setError('Confira produto, tamanho e quantidade.');
      return;
    }
    const selected = productOfVariant(products, variantId);
    if (selected?.tracksLot && !lotCode.trim()) {
      setError('Este produto controla lote. Informe o código do lote.');
      return;
    }
    setSaving(true);
    try {
      const result = await moveDistributorStock({
        variantId,
        direction: 'IN',
        quantity: amount,
        lotCode: lotCode.trim() || undefined,
        expiresOn: expiresOn || undefined,
      });
      const supplierHint = manualSupplierId
        ? ` Fornecedor selecionado: ${
            suppliers.find((row) => row.id === manualSupplierId)?.name ?? 'ok'
          }.`
        : '';
      setNotice(
        `Entrada registrada. Saldo de ${result.productName} ${result.label}: ${result.balance}${result.lotSummary ? `. Lote ${result.lotSummary}` : ''}.${stockFinanceFollowUp(result, 'pagar')}${supplierHint}`,
      );
      setProducts(await listDistributorProducts());
      setQuantity('1');
      setLotCode('');
      setExpiresOn('');
      setVariantId('');
      setFocusProductId('');
      setScannedLabel(null);
      scanRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na entrada.');
    } finally {
      setSaving(false);
    }
  }

  function parseMoneyToCents(raw: string): number | null {
    const text = raw.trim().replace(',', '.');
    if (!text) return null;
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Valor em R$ inválido.');
    }
    return Math.round(value * 100);
  }

  async function onCreateProduct(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const variants = newSizes
      .split(/[,;/|]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (newName.trim().length < 2 || newSku.trim().length < 1 || variants.length === 0) {
      setError('Informe nome, SKU e ao menos um tamanho (ou Único).');
      return;
    }
    setSaving(true);
    try {
      const created = await createDistributorProduct({
        name: newName.trim(),
        internalSku: newSku.trim(),
        ncm: newNcm.trim() || undefined,
        costCents: parseMoneyToCents(newCost) ?? undefined,
        salePriceCents: parseMoneyToCents(newSale) ?? undefined,
        variants,
      });
      const refreshed = await listDistributorProducts();
      setProducts(refreshed);
      const firstVariant = created.variants[0]?.id ?? '';
      if (createForLineId && document) {
        if (variants.length === 1 && firstVariant) {
          const updated = await linkDistributorLine(
            document.id,
            createForLineId,
            firstVariant,
          );
          setDocument(updated);
          setLineProductIds((current) => ({
            ...current,
            [createForLineId]: created.id,
          }));
          setNotice('Produto cadastrado e vinculado à linha da nota.');
        } else {
          setLineProductIds((current) => ({
            ...current,
            [createForLineId]: created.id,
          }));
          setNotice('Produto cadastrado. Escolha o tamanho na linha da nota.');
        }
      } else {
        setFocusProductId(created.id);
        setVariantId(variants.length === 1 ? firstVariant : '');
        setNotice(
          variants.length > 1
            ? 'Produto cadastrado. Toque no tamanho e confirme a entrada.'
            : 'Produto cadastrado e selecionado para entrada.',
        );
      }
      setShowNewProduct(false);
      setCreateForLineId(null);
      setNewName('');
      setNewSku('');
      setNewSizes('Único');
      setNewNcm('');
      setNewCost('');
      setNewSale('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cadastrar produto.');
    } finally {
      setSaving(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const draft = await extractDistributorInvoice(file);
      setDocument(draft);
      setSupplierId(draft.supplierId ?? '');
      const initial: Record<string, string> = {};
      for (const line of draft.lines) {
        const product = productOfVariant(products, line.variantId);
        if (product) initial[line.id] = product.id;
      }
      setLineProductIds(initial);
      setInvoiceOpen(true);
      setNotice(draft.message || 'Rascunho criado. O estoque ainda não mudou.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ler a nota.');
    } finally {
      setSaving(false);
    }
  }

  async function onLink(
    lineId: string,
    nextVariantId: string,
    lot?: { lotCode?: string | null; expiresOn?: string | null },
  ) {
    if (!document) return;
    setError(null);
    try {
      const updated = await linkDistributorLine(
        document.id,
        lineId,
        nextVariantId || null,
        lot,
      );
      setDocument(updated);
      if (nextVariantId) {
        const product = productOfVariant(products, nextVariantId);
        if (product) {
          setLineProductIds((current) => ({ ...current, [lineId]: product.id }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao vincular.');
    }
  }

  async function onConfirm() {
    if (!document) return;
    const linked = document.lines.filter((line) => line.variantId).length;
    const total = document.lines.length;
    if (linked === 0) {
      setError('Vincule ao menos uma linha a um tamanho antes de confirmar.');
      return;
    }
    if (linked < total) {
      const ok = window.confirm(
        `${total - linked} linha(s) sem tamanho serão ignoradas no estoque. Confirmar mesmo assim?`,
      );
      if (!ok) return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await confirmDistributorInbound(document.id);
      setDocument(updated);
      setNotice('Entrada confirmada. O saldo foi atualizado uma vez.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao confirmar.');
    } finally {
      setSaving(false);
    }
  }

  async function onDiscard() {
    if (!document) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await discardDistributorInbound(document.id);
      setDocument(updated);
      setNotice('Rascunho descartado. O saldo não mudou.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao descartar.');
    } finally {
      setSaving(false);
    }
  }

  function startCreateFromLine(line: DistributorInboundLine) {
    setCreateForLineId(line.id);
    setNewName(line.description.slice(0, 120));
    setNewSku(line.productCode || line.gtin || `SKU-${Date.now().toString().slice(-6)}`);
    setNewSizes('Único');
    setNewNcm(line.ncm ?? '');
    setNewCost(
      line.unitCostCents != null
        ? (line.unitCostCents / 100).toFixed(2).replace('.', ',')
        : '',
    );
    setNewSale('');
    setShowNewProduct(true);
    setInvoiceOpen(true);
  }

  const tracksLot = Boolean(focusProduct?.tracksLot);

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Distribuidora</p>
          <h1 className="page-title">Entrada</h1>
          <p className="page-lead">
            Escaneie o código, toque no tamanho e confirme o que vai entrar. Sem
            XML, cadastre produto e fornecedor aqui.
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
        inputId="scan-code"
        inputRef={scanRef}
        value={scanCode}
        onChange={setScanCode}
        onResolve={resolveScan}
        scannedLabel={scannedLabel}
        products={products}
        mode="entrada"
      />

      <form className="form dash-panel stock-confirm-form" onSubmit={onManual}>
        <h2 className="dash-panel__title">Confirmar entrada</h2>
        <div className="form-grid">
          <div className="field field--span-2">
            <PartyPicker
              kind="supplier"
              label="Fornecedor (opcional nesta entrada rápida)"
              value={manualSupplierId}
              options={suppliers}
              required={false}
              onChange={setManualSupplierId}
              onCreated={(party) =>
                setSuppliers((current) =>
                  current.some((row) => row.id === party.id)
                    ? current
                    : [party as DistributorSupplier, ...current],
                )
              }
              createParty={createSupplier}
            />
          </div>

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
                }))}
                value={variantId}
                onChange={(id) => {
                  setVariantId(id);
                  window.setTimeout(() => qtyRef.current?.focus(), 30);
                }}
              />
              <p className="field-hint">
                Só aparecem os tamanhos deste produto. Toque no número certo
                (ex.: 42, não o vizinho 44).
              </p>
            </div>
          ) : null}

          {tracksLot ? (
            <>
              <div className="field">
                <label htmlFor="lote">Lote</label>
                <input
                  id="lote"
                  value={lotCode}
                  onChange={(e) => setLotCode(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="validade">Validade</label>
                <input
                  id="validade"
                  type="date"
                  value={expiresOn}
                  onChange={(e) => setExpiresOn(e.target.value)}
                />
              </div>
            </>
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
            <strong>Vai entrar:</strong> {confirmLabel}
          </div>
        ) : (
          <p className="field-hint">
            Escaneie ou escolha o produto, toque no tamanho e informe a
            quantidade para ver a confirmação.
          </p>
        )}

        <div className="header-actions product-form__actions">
          <button
            className="btn btn-primary"
            type="submit"
            disabled={saving || !confirmLabel}
          >
            Confirmar entrada
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setShowNewProduct((open) => !open);
              setCreateForLineId(null);
            }}
          >
            {showNewProduct ? 'Fechar cadastro' : 'Novo produto'}
          </button>
        </div>
      </form>

      {showNewProduct ? (
        <form className="form dash-panel" onSubmit={onCreateProduct}>
          <h2 className="dash-panel__title">
            {createForLineId
              ? 'Cadastrar produto da linha da nota'
              : 'Cadastrar produto na entrada'}
          </h2>
          <div className="form-grid">
            <div className="field field--span-2">
              <label>Nome *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>SKU interno *</label>
              <input
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Tamanhos *</label>
              <input
                value={newSizes}
                onChange={(e) => setNewSizes(e.target.value)}
                placeholder="Único ou 38, 39, 40"
                required
              />
              <p className="field-hint">Separe por vírgula. Ex.: 38, 39, 40.</p>
            </div>
            <div className="field">
              <label>Custo (R$)</label>
              <input
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </div>
            <div className="field">
              <label>Preço de venda (R$)</label>
              <input
                value={newSale}
                onChange={(e) => setNewSale(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </div>
            <div className="field">
              <label>NCM</label>
              <input value={newNcm} onChange={(e) => setNewNcm(e.target.value)} />
            </div>
          </div>
          <div className="product-form__actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {createForLineId
                ? 'Cadastrar e vincular à nota'
                : 'Cadastrar e selecionar'}
            </button>
          </div>
        </form>
      ) : null}

      <section className="dash-panel">
        <h2 className="dash-panel__title">
          <button
            type="button"
            className="product-form__toggle"
            aria-expanded={invoiceOpen || Boolean(document)}
            onClick={() => setInvoiceOpen((open) => !open)}
          >
            {invoiceOpen || document ? '▾' : '▸'} Nota de compra
            <span className="product-form__optional">
              XML traz impostos; sem XML use o cadastro acima
            </span>
          </button>
        </h2>
        {invoiceOpen || document ? (
          <>
            <div className="field">
              <label htmlFor="nota">XML da NF-e, PDF ou imagem</label>
              <input
                id="nota"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,.xml,text/xml,application/xml"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>
            {document ? (
              <>
                <p className="field-hint">
                  {document.supplierName ?? 'Fornecedor não lido'}
                  {document.supplierCnpj ? ` · CNPJ ${document.supplierCnpj}` : ''}
                  {document.invoiceNumber ? ` · Nota ${document.invoiceNumber}` : ''}
                  {document.accessKey ? ` · Chave ${document.accessKey}` : ''}
                  {` · ${document.status}`}
                  {document.supplierId ? ' · Fornecedor vinculado' : ''}
                </p>
                {document.taxSummary ? (
                  <div className="cnpj-lookup-slot">
                    <strong>Totais da nota</strong>
                    <p className="muted">
                      Produtos {money(document.taxSummary.productsCents)}
                      {document.taxSummary.freightCents
                        ? ` · Frete ${money(document.taxSummary.freightCents)}`
                        : ''}
                      {document.taxSummary.discountCents
                        ? ` · Desc. ${money(document.taxSummary.discountCents)}`
                        : ''}
                      {document.taxSummary.icmsCents
                        ? ` · ICMS ${money(document.taxSummary.icmsCents)}`
                        : ''}
                      {document.taxSummary.icmsStCents
                        ? ` · ST ${money(document.taxSummary.icmsStCents)}`
                        : ''}
                      {document.taxSummary.ipiCents
                        ? ` · IPI ${money(document.taxSummary.ipiCents)}`
                        : ''}
                      {document.taxSummary.pisCents
                        ? ` · PIS ${money(document.taxSummary.pisCents)}`
                        : ''}
                      {document.taxSummary.cofinsCents
                        ? ` · COFINS ${money(document.taxSummary.cofinsCents)}`
                        : ''}
                      {` · Total NF ${money(document.taxSummary.invoiceCents)}`}
                    </p>
                  </div>
                ) : null}
                {document.status === 'DRAFT' && !document.supplierId ? (
                  <PartyPicker
                    kind="supplier"
                    label="Vincular ou cadastrar fornecedor"
                    value={supplierId}
                    options={suppliers}
                    defaults={{
                      name: document.supplierName ?? '',
                      cnpj: document.supplierCnpj ?? '',
                    }}
                    onChange={(id) => {
                      setSupplierId(id);
                      if (!id) return;
                      setSaving(true);
                      void linkInboundSupplier(document.id, id)
                        .then((updated) => {
                          setDocument(updated);
                          setNotice('Fornecedor vinculado à nota.');
                        })
                        .catch((err: unknown) =>
                          setError(
                            err instanceof Error
                              ? err.message
                              : 'Falha ao vincular fornecedor.',
                          ),
                        )
                        .finally(() => setSaving(false));
                    }}
                    onCreated={(party) =>
                      setSuppliers((current) =>
                        current.some((row) => row.id === party.id)
                          ? current
                          : [party as DistributorSupplier, ...current],
                      )
                    }
                    createParty={createSupplier}
                  />
                ) : null}
                <div className="inbound-lines">
                  {document.lines.map((line) => {
                    const linkedProduct =
                      productOfVariant(products, line.variantId) ??
                      products.find((row) => row.id === lineProductIds[line.id]) ??
                      null;
                    const productId = linkedProduct?.id ?? lineProductIds[line.id] ?? '';
                    const sizeOptions =
                      products
                        .find((row) => row.id === productId)
                        ?.variants.map((variant) => ({
                          id: variant.id,
                          label: variant.label,
                        })) ?? [];
                    return (
                      <article key={line.id} className="inbound-line-card">
                        <header>
                          <strong>{line.description}</strong>
                          <span className="muted">
                            Qtd {line.quantity}
                            {line.unitCostCents != null
                              ? ` · ${money(line.unitCostCents)}`
                              : ''}
                          </span>
                          {line.ncm ? (
                            <span className="table-sub">NCM {line.ncm}</span>
                          ) : null}
                          {line.caNumber ? (
                            <span className="table-sub">CA {line.caNumber}</span>
                          ) : null}
                          {lineTaxHint(line) ? (
                            <span className="table-sub">{lineTaxHint(line)}</span>
                          ) : null}
                        </header>
                        <div className="form-grid">
                          <div className="field field--span-2">
                            <label htmlFor={`prod-${line.id}`}>Produto do catálogo</label>
                            <select
                              id={`prod-${line.id}`}
                              value={productId}
                              disabled={document.status !== 'DRAFT'}
                              onChange={(e) => {
                                const next = e.target.value;
                                setLineProductIds((current) => ({
                                  ...current,
                                  [line.id]: next,
                                }));
                                if (line.variantId) {
                                  void onLink(line.id, '');
                                }
                              }}
                            >
                              <option value="">Não entra / escolher…</option>
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name} ({product.internalSku})
                                </option>
                              ))}
                            </select>
                          </div>
                          {productId ? (
                            <div className="field field--span-2">
                              <label>Tamanho</label>
                              <SizeChips
                                options={sizeOptions}
                                value={line.variantId ?? ''}
                                disabled={document.status !== 'DRAFT'}
                                onChange={(id) => void onLink(line.id, id)}
                              />
                            </div>
                          ) : null}
                          <div className="field">
                            <label htmlFor={`lote-${line.id}`}>Lote</label>
                            <input
                              id={`lote-${line.id}`}
                              defaultValue={line.lotCode ?? ''}
                              disabled={document.status !== 'DRAFT'}
                              onBlur={(e) =>
                                onLink(line.id, line.variantId ?? '', {
                                  lotCode: e.target.value,
                                  expiresOn: line.expiresOn,
                                })
                              }
                            />
                          </div>
                          <div className="field">
                            <label htmlFor={`val-${line.id}`}>Validade</label>
                            <input
                              id={`val-${line.id}`}
                              type="date"
                              defaultValue={line.expiresOn ?? ''}
                              disabled={document.status !== 'DRAFT'}
                              onBlur={(e) =>
                                onLink(line.id, line.variantId ?? '', {
                                  lotCode: line.lotCode,
                                  expiresOn: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        {document.status === 'DRAFT' && !line.variantId ? (
                          <div className="product-form__actions">
                            <button
                              type="button"
                              className="btn"
                              onClick={() => startCreateFromLine(line)}
                            >
                              Criar produto
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
                {document.status === 'DRAFT' ? (
                  <div className="header-actions product-form__actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={saving}
                      onClick={onConfirm}
                    >
                      Confirmar entrada da nota
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={saving}
                      onClick={onDiscard}
                    >
                      Descartar
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
