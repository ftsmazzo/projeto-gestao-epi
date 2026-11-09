'use client';

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { PartyPicker } from '../../../components/distributor/PartyPicker';
import {
  SizeChips,
  formatVariantConfirmLabel,
} from '../../../components/distributor/SizeChips';
import { DistributorScanPanel } from '../../../components/DistributorScanPanel';
import { useSearchParams } from 'next/navigation';
import { formatCnpjInput, normalizeCnpj } from '../../../lib/cnpj';
import {
  confirmDistributorInbound,
  createDistributorProduct,
  createSupplier,
  discardDistributorInbound,
  extractDistributorInvoice,
  getDistributorInbound,
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

function DistribuidoraEntradaPageInner() {
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
  const searchParams = useSearchParams();
  const [supplierId, setSupplierId] = useState('');
  const [manualSupplierId, setManualSupplierId] = useState('');
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newSupplierSku, setNewSupplierSku] = useState('');
  const [newGtin, setNewGtin] = useState('');
  const [newCa, setNewCa] = useState('');
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

  useEffect(() => {
    const docId = searchParams.get('doc')?.trim();
    if (!docId) return;
    setSaving(true);
    void getDistributorInbound(docId)
      .then((draft) => {
        setDocument(draft);
        setSupplierId(draft.supplierId ?? '');
        setNotice(draft.message || 'Nota carregada. Vincule os tamanhos e confirme.');
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao abrir a nota.'),
      )
      .finally(() => setSaving(false));
  }, [searchParams]);

  const focusProduct = useMemo(
    () => products.find((row) => row.id === focusProductId) ?? null,
    [products, focusProductId],
  );

  const emitenteCnpjDigits = useMemo(() => {
    if (!document?.supplierCnpj) return '';
    const digits = normalizeCnpj(document.supplierCnpj);
    return digits.length === 14 ? digits : '';
  }, [document?.supplierCnpj]);

  const linkedSupplierMismatch = useMemo(() => {
    if (!document?.supplierId || !emitenteCnpjDigits) return false;
    const linked = suppliers.find((row) => row.id === document.supplierId);
    if (!linked?.cnpj) return true;
    return normalizeCnpj(linked.cnpj) !== emitenteCnpjDigits;
  }, [document?.supplierId, emitenteCnpjDigits, suppliers]);

  const needsSupplierConfirm =
    document?.status === 'DRAFT' &&
    (!document.supplierId || linkedSupplierMismatch);

  const matchingSuppliers = useMemo(() => {
    if (!emitenteCnpjDigits) return suppliers;
    return suppliers.filter(
      (row) => row.cnpj && normalizeCnpj(row.cnpj) === emitenteCnpjDigits,
    );
  }, [emitenteCnpjDigits, suppliers]);

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
        supplierSku: newSupplierSku.trim() || undefined,
        gtin: newGtin.trim() || undefined,
        caNumber: newCa.trim() || undefined,
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
          setNotice('Produto cadastrado com dados da nota e vinculado à linha.');
        } else {
          setLineProductIds((current) => ({
            ...current,
            [createForLineId]: created.id,
          }));
          setNotice(
            'Produto cadastrado com dados da nota. Escolha o tamanho na linha.',
          );
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
      resetNewProductForm();
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
      let suggested = 0;
      let missing = 0;
      for (const line of draft.lines) {
        const linked = productOfVariant(products, line.variantId);
        if (linked) {
          initial[line.id] = linked.id;
          continue;
        }
        const suggestedProduct = products.find((product) => {
          const gtin = line.gtin?.replace(/\D/g, '') ?? '';
          if (gtin && product.gtin && product.gtin.replace(/\D/g, '') === gtin) {
            return true;
          }
          const code = line.productCode?.trim().toLowerCase();
          if (!code) return false;
          return (
            product.internalSku.trim().toLowerCase() === code ||
            product.supplierSku?.trim().toLowerCase() === code
          );
        });
        if (suggestedProduct) {
          initial[line.id] = suggestedProduct.id;
          suggested += 1;
        } else if (line.quantity > 0) {
          missing += 1;
        }
      }
      setLineProductIds(initial);
      const hints = [
        draft.message || 'Rascunho criado. O estoque ainda não mudou.',
        suggested
          ? `${suggested} linha(s) sugeridas por código/GTIN — confirme o tamanho.`
          : null,
        missing
          ? `${missing} linha(s) sem produto no catálogo: cadastre com os dados da nota antes de confirmar.`
          : null,
      ].filter(Boolean);
      setNotice(hints.join(' '));
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
    const emitenteDigits = document.supplierCnpj
      ? normalizeCnpj(document.supplierCnpj)
      : '';
    if (emitenteDigits.length === 14 && !document.supplierId) {
      setError(
        'Cadastre ou vincule o fornecedor emitente (mesmo CNPJ da nota) antes de confirmar.',
      );
      return;
    }
    const pendingLines = document.lines.filter(
      (line) => line.quantity > 0 && !line.variantId,
    );
    if (pendingLines.length > 0) {
      setError(
        `${pendingLines.length} linha(s) ainda sem produto cadastrado/vinculado. Cadastre com os dados da nota ou vincule a um produto existente antes de confirmar.`,
      );
      return;
    }
    if (document.lines.every((line) => line.quantity <= 0)) {
      setError('A nota não tem linhas com quantidade para entrar no estoque.');
      return;
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

  function resetNewProductForm() {
    setShowNewProduct(false);
    setCreateForLineId(null);
    setNewName('');
    setNewSku('');
    setNewSupplierSku('');
    setNewGtin('');
    setNewCa('');
    setNewSizes('Único');
    setNewNcm('');
    setNewCost('');
    setNewSale('');
  }

  function suggestCatalogProduct(line: DistributorInboundLine) {
    const code = line.productCode?.trim();
    const gtin = line.gtin?.replace(/\D/g, '') ?? '';
    return (
      products.find((product) => {
        if (gtin && product.gtin && product.gtin.replace(/\D/g, '') === gtin) {
          return true;
        }
        if (code) {
          const sku = product.internalSku.trim().toLowerCase();
          const supplier = product.supplierSku?.trim().toLowerCase() ?? '';
          const needle = code.toLowerCase();
          if (sku === needle || supplier === needle) return true;
        }
        return false;
      }) ?? null
    );
  }

  async function startCreateFromLine(line: DistributorInboundLine) {
    if (!document) return;
    const existing = suggestCatalogProduct(line);
    if (existing) {
      setLineProductIds((current) => ({ ...current, [line.id]: existing.id }));
      setCreateForLineId(null);
      setShowNewProduct(false);
      if (existing.variants.length === 1 && existing.variants[0]?.id) {
        setSaving(true);
        try {
          const updated = await linkDistributorLine(
            document.id,
            line.id,
            existing.variants[0].id,
          );
          setDocument(updated);
          setNotice(
            `Produto existente ${existing.name} vinculado automaticamente à linha.`,
          );
        } catch (err: unknown) {
          setError(
            err instanceof Error
              ? err.message
              : 'Falha ao vincular produto sugerido.',
          );
        } finally {
          setSaving(false);
        }
      } else {
        setNotice(
          `Produto já existe no catálogo: ${existing.name}. Selecione o tamanho na linha.`,
        );
      }
      return;
    }
    setCreateForLineId(line.id);
    setNewName(line.description.slice(0, 120));
    setNewSku(
      line.productCode ||
        line.gtin ||
        `SKU-${Date.now().toString().slice(-6)}`,
    );
    setNewSupplierSku(line.productCode ?? '');
    setNewGtin(line.gtin ?? '');
    setNewCa(line.caNumber ?? '');
    setNewSizes('Único');
    setNewNcm(line.ncm ?? '');
    setNewCost(
      line.unitCostCents != null
        ? (line.unitCostCents / 100).toFixed(2).replace('.', ',')
        : '',
    );
    setNewSale('');
    setShowNewProduct(true);
    setNotice(
      'Cadastre o produto com os dados da nota. Sem cadastro/vínculo a linha não entra no estoque.',
    );
  }

  const tracksLot = Boolean(focusProduct?.tracksLot);

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Distribuidora</p>
          <h1 className="page-title">Entrada</h1>
          <p className="page-lead">
            Na nota, cada linha precisa de produto no catálogo (cadastro com
            dados da NF ou vínculo). Sem isso a entrada não confirma.
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

      <section className="dash-panel intake-hub" aria-label="Arquivo da nota">
        <div className="dash-panel__head">
          <h2>Arquivo da nota</h2>
        </div>
        <div className="intake-hub__body">
          <div className="intake-dropzone">
            <label className="intake-dropzone__label" htmlFor="nota-topo">
              <strong>
                {saving ? 'Lendo arquivo…' : 'XML da NF-e, PDF ou imagem'}
              </strong>
              <span>
                Um clique aqui. XML traz impostos; PDF/imagem vira rascunho para
                vincular tamanhos.
              </span>
            </label>
            <input
              id="nota-topo"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,.xml,text/xml,application/xml"
              disabled={saving}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
        </div>
      </section>

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
              if (showNewProduct) {
                resetNewProductForm();
              } else {
                setCreateForLineId(null);
                setShowNewProduct(true);
              }
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
              ? 'Cadastrar produto com dados da nota'
              : 'Cadastrar produto na entrada'}
          </h2>
          {createForLineId ? (
            <p className="field-hint">
              Os campos vieram da linha da NF. Revise e salve para o item entrar
              no catálogo e no estoque juntos.
            </p>
          ) : null}
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
              <label>SKU fornecedor</label>
              <input
                value={newSupplierSku}
                onChange={(e) => setNewSupplierSku(e.target.value)}
                placeholder="cProd da nota"
              />
            </div>
            <div className="field">
              <label>GTIN / EAN</label>
              <input
                value={newGtin}
                onChange={(e) => setNewGtin(e.target.value)}
                placeholder="Código de barras"
              />
            </div>
            <div className="field">
              <label>CA</label>
              <input
                value={newCa}
                onChange={(e) => setNewCa(e.target.value)}
                placeholder="Quando houver"
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
                ? 'Cadastrar produto e vincular à nota'
                : 'Cadastrar e selecionar'}
            </button>
          </div>
        </form>
      ) : null}

      {document ? (
      <section className="dash-panel catalog-section">
        <div className="dash-panel__head">
          <h2>Nota de compra — vincular tamanhos</h2>
        </div>
        <div className="catalog-section__body">
                <p className="field-hint">
                  {document.supplierName ?? 'Fornecedor não lido'}
                  {document.supplierCnpj
                    ? ` · CNPJ ${formatCnpjInput(document.supplierCnpj)}`
                    : ''}
                  {document.invoiceNumber ? ` · Nota ${document.invoiceNumber}` : ''}
                  {document.accessKey ? ` · Chave ${document.accessKey}` : ''}
                  {` · ${document.status}`}
                  {document.supplierId ? ' · Fornecedor vinculado' : ' · Fornecedor pendente'}
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
                {linkedSupplierMismatch ? (
                  <div className="cnpj-lookup-slot" role="alert">
                    <p className="error">
                      O fornecedor vinculado não tem o mesmo CNPJ do emitente da
                      nota. Revincule ou cadastre o emitente correto.
                    </p>
                  </div>
                ) : null}
                {needsSupplierConfirm ? (
                  <div className="field field--span-2">
                    <PartyPicker
                      kind="supplier"
                      label="Fornecedor emitente da nota"
                      value={supplierId}
                      options={matchingSuppliers}
                      autoOpen={!document.supplierId || Boolean(document.pendingSupplier)}
                      fullForm
                      title="Confirmar cadastro do emitente"
                      submitLabel="Cadastrar e vincular à nota"
                      hint={
                        document.pendingSupplier
                          ? `CNPJ ${formatCnpjInput(document.pendingSupplier.cnpj)} não está na base. Revise os dados (Buscar CNPJ / CEP) e cadastre, ou selecione o cadastro com o mesmo CNPJ.`
                          : document.supplierCnpj
                            ? `Só entram fornecedores com CNPJ ${formatCnpjInput(document.supplierCnpj)}. Cadastro errado é bloqueado.`
                            : 'Selecione ou cadastre o fornecedor da nota.'
                      }
                      defaults={{
                        name:
                          document.pendingSupplier?.name ??
                          document.supplierName ??
                          '',
                        cnpj: formatCnpjInput(
                          document.pendingSupplier?.cnpj ??
                            document.supplierCnpj ??
                            '',
                        ),
                        stateRegistration:
                          document.pendingSupplier?.stateRegistration ?? '',
                        uf: document.pendingSupplier?.uf ?? '',
                        street: document.pendingSupplier?.street ?? '',
                        number: document.pendingSupplier?.number ?? '',
                        complement: document.pendingSupplier?.complement ?? '',
                        district: document.pendingSupplier?.district ?? '',
                        city: document.pendingSupplier?.city ?? '',
                        zipCode: document.pendingSupplier?.zipCode ?? '',
                        phone: document.pendingSupplier?.phone ?? '',
                      }}
                      onChange={(id) => {
                        setSupplierId(id);
                        if (!id) return;
                        setSaving(true);
                        void linkInboundSupplier(document.id, id)
                          .then((updated) => {
                            setDocument(updated);
                            setNotice(
                              'Fornecedor vinculado à nota pelo CNPJ do emitente.',
                            );
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
                  </div>
                ) : null}
                {document.status === 'DRAFT' ? (
                  <p className="field-hint">
                    {
                      document.lines.filter(
                        (line) => line.quantity > 0 && !line.variantId,
                      ).length
                    }{' '}
                    linha(s) pendente(s) de cadastro/vínculo. Produto novo usa
                    nome, SKU, GTIN, NCM, CA e custo da nota.
                  </p>
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
                    const needsProduct =
                      document.status === 'DRAFT' &&
                      line.quantity > 0 &&
                      !line.variantId;
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
                          {line.productCode ? (
                            <span className="table-sub">
                              Cód. {line.productCode}
                            </span>
                          ) : null}
                          {line.gtin ? (
                            <span className="table-sub">GTIN {line.gtin}</span>
                          ) : null}
                          {line.ncm ? (
                            <span className="table-sub">NCM {line.ncm}</span>
                          ) : null}
                          {line.caNumber ? (
                            <span className="table-sub">CA {line.caNumber}</span>
                          ) : null}
                          {lineTaxHint(line) ? (
                            <span className="table-sub">{lineTaxHint(line)}</span>
                          ) : null}
                          {needsProduct ? (
                            <span className="table-sub error">
                              Precisa cadastrar ou vincular produto
                            </span>
                          ) : line.variantId ? (
                            <span className="table-sub">Pronto para entrar</span>
                          ) : null}
                        </header>
                        <div className="form-grid">
                          <div className="field field--span-2">
                            <label htmlFor={`prod-${line.id}`}>
                              Produto do catálogo
                            </label>
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
                              <option value="">
                                Selecione produto existente…
                              </option>
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
                        {needsProduct ? (
                          <div className="product-form__actions">
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={saving}
                              onClick={() => void startCreateFromLine(line)}
                            >
                              {suggestCatalogProduct(line)
                                ? 'Usar produto sugerido do catálogo'
                                : 'Cadastrar produto com dados da nota'}
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
                      disabled={
                        saving ||
                        document.lines.some(
                          (line) => line.quantity > 0 && !line.variantId,
                        )
                      }
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
        </div>
      </section>
      ) : null}
    </div>
  );
}

export default function DistribuidoraEntradaPage() {
  return (
    <Suspense fallback={<p className="page-lead">Carregando entrada…</p>}>
      <DistribuidoraEntradaPageInner />
    </Suspense>
  );
}
