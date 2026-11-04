'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { PartyPicker } from '../../../components/distributor/PartyPicker';
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

export default function DistribuidoraEntradaPage() {
  const [products, setProducts] = useState<DistributorProduct[]>([]);
  const [suppliers, setSuppliers] = useState<DistributorSupplier[]>([]);
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
  const [createForLineId, setCreateForLineId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const sizeRef = useRef<HTMLSelectElement>(null);
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
      setVariantId(nextId);
      setScannedLabel(
        multi
          ? `${found.product.name} — escolha o tamanho abaixo`
          : found.product.name,
      );
      setScanCode('');
      setQuantity('1');
      setNotice(
        multi
          ? 'Código lido. Selecione o tamanho antes de registrar.'
          : found.product.gtin
            ? 'Código lido. Confira a quantidade e registre a entrada.'
            : 'Produto encontrado pelo SKU. Vale cadastrar o GTIN na ficha para o leitor.',
      );
      window.setTimeout(() => {
        if (multi) sizeRef.current?.focus();
        else qtyRef.current?.focus();
      }, 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código não encontrado.');
      setScanCode('');
      scanRef.current?.focus();
    }
  }

  async function onManual(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const amount = Number(quantity);
    if (!variantId) {
      setError('Escolha o produto e o tamanho antes de registrar.');
      return;
    }
    if (!Number.isInteger(amount) || amount < 1) {
      setError('Informe uma quantidade inteira maior que zero.');
      return;
    }
    const selected = products.find((product) =>
      product.variants.some((variant) => variant.id === variantId),
    );
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
      setScannedLabel(null);
      scanRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na entrada.');
    } finally {
      setSaving(false);
    }
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
        variants,
      });
      const refreshed = await listDistributorProducts();
      setProducts(refreshed);
      const firstVariant = created.variants[0]?.id ?? '';
      if (createForLineId && document && firstVariant) {
        const updated = await linkDistributorLine(
          document.id,
          createForLineId,
          firstVariant,
        );
        setDocument(updated);
        setNotice(`Produto cadastrado e vinculado à linha da nota.`);
      } else {
        setVariantId(firstVariant);
        setNotice(
          variants.length > 1
            ? 'Produto cadastrado. Escolha o tamanho e registre a entrada.'
            : 'Produto cadastrado e selecionado para entrada.',
        );
      }
      setShowNewProduct(false);
      setCreateForLineId(null);
      setNewName('');
      setNewSku('');
      setNewSizes('Único');
      setNewNcm('');
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
    setShowNewProduct(true);
    setInvoiceOpen(true);
  }

  const tracksLot = products.some(
    (product) =>
      product.tracksLot && product.variants.some((variant) => variant.id === variantId),
  );
  const options = products.flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      label: `${product.name} · ${variant.label === 'Único' || variant.label === 'Unico' ? 'sem numeração' : variant.label}`,
    })),
  );

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Distribuidora</p>
          <h1 className="page-title">Entrada</h1>
          <p className="page-lead">
            Escaneie o código, escolha o tamanho e registre. Sem XML, cadastre
            produto e fornecedor aqui. Com XML, impostos e totais vêm organizados.
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

      <form className="form dash-panel" onSubmit={onManual}>
        <h2 className="dash-panel__title">Confirmar entrada</h2>
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
        <div className="field">
          <label htmlFor="tamanho">Produto e tamanho</label>
          <select
            id="tamanho"
            ref={sizeRef}
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            required
          >
            <option value="">Selecione o tamanho…</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="field-hint">
            Obrigatório escolher o tamanho. Com vários tamanhos o sistema não
            escolhe sozinho.
          </p>
        </div>
        {tracksLot ? (
          <>
            <div className="field">
              <label htmlFor="lote">Lote</label>
              <input id="lote" value={lotCode} onChange={(e) => setLotCode(e.target.value)} />
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
        <div className="header-actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            Registrar entrada
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
            {createForLineId ? 'Cadastrar produto da linha da nota' : 'Cadastrar produto na entrada'}
          </h2>
          <div className="field">
            <label>Nome *</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </div>
          <div className="field">
            <label>SKU interno *</label>
            <input value={newSku} onChange={(e) => setNewSku(e.target.value)} required />
          </div>
          <div className="field">
            <label>Tamanhos *</label>
            <input
              value={newSizes}
              onChange={(e) => setNewSizes(e.target.value)}
              placeholder="Único ou 38, 39, 40"
              required
            />
            <p className="field-hint">Separe por vírgula. Ex.: 38, 39, 40 ou Único.</p>
          </div>
          <div className="field">
            <label>NCM</label>
            <input value={newNcm} onChange={(e) => setNewNcm(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {createForLineId ? 'Cadastrar e vincular à nota' : 'Cadastrar e selecionar'}
          </button>
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
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Item lido</th>
                        <th scope="col">Qtd</th>
                        <th scope="col">Custo</th>
                        <th scope="col">Tamanho</th>
                        <th scope="col">Lote</th>
                        <th scope="col" />
                      </tr>
                    </thead>
                    <tbody>
                      {document.lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            {line.description}
                            {line.ncm ? (
                              <span className="table-sub">NCM {line.ncm}</span>
                            ) : null}
                            {line.caNumber ? (
                              <span className="table-sub">CA {line.caNumber}</span>
                            ) : null}
                            {lineTaxHint(line) ? (
                              <span className="table-sub">{lineTaxHint(line)}</span>
                            ) : null}
                          </td>
                          <td>{line.quantity}</td>
                          <td>
                            {line.unitCostCents != null
                              ? money(line.unitCostCents)
                              : '—'}
                          </td>
                          <td>
                            <select
                              aria-label={`Tamanho de ${line.description}`}
                              value={line.variantId ?? ''}
                              disabled={document.status !== 'DRAFT'}
                              onChange={(e) => onLink(line.id, e.target.value)}
                            >
                              <option value="">Não entra</option>
                              {options.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              aria-label={`Lote de ${line.description}`}
                              defaultValue={line.lotCode ?? ''}
                              disabled={document.status !== 'DRAFT'}
                              onBlur={(e) =>
                                onLink(line.id, line.variantId ?? '', {
                                  lotCode: e.target.value,
                                  expiresOn: line.expiresOn,
                                })
                              }
                            />
                            <input
                              aria-label={`Validade de ${line.description}`}
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
                          </td>
                          <td>
                            {document.status === 'DRAFT' && !line.variantId ? (
                              <button
                                type="button"
                                className="btn"
                                onClick={() => startCreateFromLine(line)}
                              >
                                Criar produto
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {document.status === 'DRAFT' ? (
                  <div className="header-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={saving}
                      onClick={onConfirm}
                    >
                      Confirmar entrada
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
