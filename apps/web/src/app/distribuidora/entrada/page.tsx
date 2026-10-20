'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { DistributorScanPanel } from '../../../components/DistributorScanPanel';
import {
  confirmDistributorInbound,
  discardDistributorInbound,
  extractDistributorInvoice,
  linkDistributorLine,
  listDistributorProducts,
  lookupDistributorProductByCode,
  moveDistributorStock,
  type DistributorInboundDocument,
  type DistributorProduct,
} from '../../../lib/distributor';

export default function DistribuidoraEntradaPage() {
  const [products, setProducts] = useState<DistributorProduct[]>([]);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [lotCode, setLotCode] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [scannedLabel, setScannedLabel] = useState<string | null>(null);
  const [document, setDocument] = useState<DistributorInboundDocument | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
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
      setScannedLabel(
        `${found.product.name}${found.sizes.length > 1 ? ' — escolha o tamanho abaixo' : ''}`,
      );
      setScanCode('');
      setQuantity('1');
      setNotice(
        found.product.gtin
          ? 'Código lido. Confira a quantidade e registre a entrada.'
          : 'Produto encontrado pelo SKU. Vale cadastrar o GTIN na ficha para o leitor.',
      );
      window.setTimeout(() => qtyRef.current?.focus(), 50);
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
    if (!variantId || !Number.isInteger(amount) || amount < 1) {
      setError('Escolha o tamanho e uma quantidade inteira.');
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
      setNotice(
        `Entrada registrada. Saldo de ${result.productName} ${result.label}: ${result.balance}${result.lotSummary ? `. Lote ${result.lotSummary}` : ''}.`,
      );
      setProducts(await listDistributorProducts());
      setQuantity('1');
      setLotCode('');
      setExpiresOn('');
      setScannedLabel(null);
      scanRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na entrada.');
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
            Escaneie o código de barras (ou digite o SKU), confira o tamanho e a
            quantidade. Nota de compra continua como rascunho até confirmar.
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
          <p className="field-hint">
            Tamanho = numeração (40, M…) ou “sem numeração” quando o item é único.
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
        <button className="btn btn-primary" type="submit" disabled={saving}>
          Registrar entrada
        </button>
      </form>
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
              opcional — recebimento por bipagem continua acima
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
                  {document.invoiceNumber ? ` · Nota ${document.invoiceNumber}` : ''}
                  {document.accessKey ? ` · Chave ${document.accessKey}` : ''}
                  {` · ${document.status}`}
                </p>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Item lido</th>
                        <th scope="col">Qtd</th>
                        <th scope="col">Tamanho</th>
                        <th scope="col">Lote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {document.lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            {line.description}
                            {line.caNumber ? (
                              <span className="table-sub">CA {line.caNumber}</span>
                            ) : null}
                          </td>
                          <td>{line.quantity}</td>
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
