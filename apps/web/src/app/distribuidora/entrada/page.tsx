'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  confirmDistributorInbound,
  discardDistributorInbound,
  extractDistributorInvoice,
  linkDistributorLine,
  listDistributorProducts,
  moveDistributorStock,
  type DistributorInboundDocument,
  type DistributorProduct,
} from '../../../lib/distributor';

export default function DistribuidoraEntradaPage() {
  const [products, setProducts] = useState<DistributorProduct[]>([]);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [document, setDocument] = useState<DistributorInboundDocument | null>(null);
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

  async function onManual(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const amount = Number(quantity);
    if (!variantId || !Number.isInteger(amount) || amount < 1) {
      setError('Escolha a variante e uma quantidade inteira.');
      return;
    }
    setSaving(true);
    try {
      const result = await moveDistributorStock({
        variantId,
        direction: 'IN',
        quantity: amount,
      });
      setNotice(
        `Entrada registrada. Saldo de ${result.productName} ${result.label}: ${result.balance}.`,
      );
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
      setNotice(draft.message || 'Rascunho criado. O estoque ainda nao mudou.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ler a nota.');
    } finally {
      setSaving(false);
    }
  }

  async function onLink(lineId: string, nextVariantId: string) {
    if (!document) return;
    setError(null);
    try {
      const updated = await linkDistributorLine(
        document.id,
        lineId,
        nextVariantId || null,
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
      setNotice('Rascunho descartado. O saldo nao mudou.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao descartar.');
    } finally {
      setSaving(false);
    }
  }

  const options = products.flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      label: `${product.name} · ${variant.label}`,
    })),
  );

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Distribuidora</p>
          <h1 className="page-title">Entrada</h1>
          <p className="page-lead">
            Entrada manual ou nota de compra. A nota vira rascunho e so altera
            o saldo depois da confirmacao.
          </p>
        </div>
      </header>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="field-hint">{notice}</p> : null}
      <form className="form dash-panel" onSubmit={onManual}>
        <h2 className="dash-panel__title">Entrada manual</h2>
        <div className="field">
          <label htmlFor="variante">Variante</label>
          <select
            id="variante"
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
        <div className="field">
          <label htmlFor="qtd">Quantidade</label>
          <input
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
        <h2 className="dash-panel__title">Nota de compra</h2>
        <div className="field">
          <label htmlFor="nota">Arquivo PDF ou imagem</label>
          <input
            id="nota"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
        {document ? (
          <>
            <p className="field-hint">
              {document.supplierName ?? 'Fornecedor nao lido'}
              {document.invoiceNumber ? ` · Nota ${document.invoiceNumber}` : ''}
              {` · ${document.status}`}
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Item lido</th>
                    <th scope="col">Qtd</th>
                    <th scope="col">Variante</th>
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
                          aria-label={`Variante de ${line.description}`}
                          value={line.variantId ?? ''}
                          disabled={document.status !== 'DRAFT'}
                          onChange={(e) => onLink(line.id, e.target.value)}
                        >
                          <option value="">Nao entra</option>
                          {options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
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
      </section>
    </div>
  );
}
