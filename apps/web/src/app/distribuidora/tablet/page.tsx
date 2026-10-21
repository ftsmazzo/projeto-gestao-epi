'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  createCustomer,
  createFieldQuote,
  getMySellerCeiling,
  listCustomers,
  listDistributorProducts,
  parseReaisToCents,
  variantCatalogPrice,
  type DistributorCustomer,
  type DistributorProduct,
  type FieldQuoteResult,
  type MySellerCeiling,
} from '../../../lib/distributor';

type DraftLine = {
  variantId: string;
  quantity: string;
  price: string;
  discount: string;
};

function money(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function DistribuidoraTabletPage() {
  const [customers, setCustomers] = useState<DistributorCustomer[]>([]);
  const [products, setProducts] = useState<DistributorProduct[]>([]);
  const [ceiling, setCeiling] = useState<MySellerCeiling | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [visitedAt, setVisitedAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [summary, setSummary] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [priceMissing, setPriceMissing] = useState(false);
  const [discount, setDiscount] = useState('0');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [lastResult, setLastResult] = useState<FieldQuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const options = products.flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      label: `${product.name} · ${variant.label}`,
      quantity: variant.quantity,
    })),
  );

  useEffect(() => {
    void Promise.all([
      listCustomers(),
      listDistributorProducts(),
      getMySellerCeiling(),
    ])
      .then(([customerRows, productRows, ceilingRow]) => {
        setCustomers(customerRows);
        setProducts(productRows);
        setCeiling(ceilingRow);
        if (customerRows[0]) setCustomerId(customerRows[0].id);
        const first = productRows[0]?.variants[0]?.id;
        if (first) setVariantId(first);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  useEffect(() => {
    const next = variantCatalogPrice(products, variantId);
    setPrice(next.price);
    setPriceMissing(next.missingValue);
  }, [products, variantId]);

  async function onCreateCustomer(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const created = await createCustomer({ name: newCustomerName });
      setNewCustomerName('');
      setCustomerId(created.id);
      setCustomers(await listCustomers());
      setNotice('Cliente pronto para a visita.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao cadastrar.');
    } finally {
      setSaving(false);
    }
  }

  function addLine() {
    setError(null);
    const amount = Number(quantity);
    const cents = parseReaisToCents(price);
    const discountPercent = Number(discount.replace(',', '.'));
    if (!variantId) {
      setError('Escolha o item do orçamento.');
      return;
    }
    if (!Number.isInteger(amount) || amount < 1) {
      setError('A quantidade precisa ser um número inteiro maior que zero.');
      return;
    }
    if (cents == null) {
      setError(
        price.trim()
          ? 'Informe o preço com um valor válido. Exemplo: 12,50.'
          : 'Este produto não tem valor cadastrado. Informe o preço ou complete o custo na ficha do produto.',
      );
      return;
    }
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      setError('O desconto precisa ficar entre 0 e 100.');
      return;
    }
    setDraftLines((current) => [
      ...current,
      {
        variantId,
        quantity: String(amount),
        price: (cents / 100).toFixed(2).replace('.', ','),
        discount: String(discountPercent),
      },
    ]);
    setQuantity('1');
    setDiscount('0');
    const next = variantCatalogPrice(products, variantId);
    setPrice(next.price);
    setPriceMissing(next.missingValue);
  }

  function removeLine(index: number) {
    setDraftLines((current) => current.filter((_, i) => i !== index));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLastResult(null);
    if (!customerId) {
      setError('Escolha o cliente da visita.');
      return;
    }
    if (draftLines.length === 0) {
      setError('Inclua ao menos um item.');
      return;
    }
    const lines = draftLines.map((line) => {
      const unitPriceCents = parseReaisToCents(line.price);
      return {
        variantId: line.variantId,
        quantity: Number(line.quantity),
        unitPriceCents: unitPriceCents ?? 0,
        discountPercent: Number(line.discount.replace(',', '.')),
      };
    });
    if (lines.some((line) => line.unitPriceCents < 0 || !Number.isInteger(line.quantity))) {
      setError('Revise precos e quantidades.');
      return;
    }
    setSaving(true);
    try {
      const result = await createFieldQuote({
        customerId,
        visitedAt,
        summary: summary || null,
        nextAction: nextAction || null,
        lines,
      });
      setLastResult(result);
      setDraftLines([]);
      setSummary('');
      setNextAction('');
      setNotice(
        result.needsApproval
          ? 'Orcamento enviado. Acima do seu teto — aguarda o gestor.'
          : 'Orcamento liberado na visita. Visita registrada na agenda.',
      );
      setCustomers(await listCustomers());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao gravar.');
    } finally {
      setSaving(false);
    }
  }

  const selectedCustomer =
    customers.find((row) => row.id === customerId) ?? null;

  return (
    <div className="module-page tablet-field">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Distribuidora</p>
          <h1 className="page-title">Tablet · Em visita</h1>
          <p className="page-lead">
            Monte o orçamento no cliente. O teto de desconto e o mesmo da mesa;
            acima dele o gestor libera.
          </p>
        </div>
      </header>

      {ceiling ? (
        <p className="tablet-field__ceiling" role="status">
          Seu teto agora: {ceiling.maxDiscountPercent.toLocaleString('pt-BR')}%
        </p>
      ) : null}

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="success">{notice}</p> : null}

      {lastResult ? (
        <section className="dash-panel tablet-field__result">
          <h2 className="dash-panel__title">Ultimo envio</h2>
          <p>
            {lastResult.quote.customerName} ·{' '}
            {lastResult.needsApproval ? 'Aguardando gestor' : 'Liberado'} ·
            concedido {money(lastResult.quote.grantedCents)}
          </p>
        </section>
      ) : null}

      <section className="dash-panel">
        <h2 className="dash-panel__title">Cliente</h2>
        <label htmlFor="tablet-customer">Quem voce esta visitando</label>
        <select
          id="tablet-customer"
          className="tablet-field__control"
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
        >
          {customers.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
              {row.city ? ` · ${row.city}` : ''}
            </option>
          ))}
        </select>
        {selectedCustomer?.lastSummary ? (
          <p className="field-hint">Ultima visita: {selectedCustomer.lastSummary}</p>
        ) : null}
        <form className="tablet-field__row" onSubmit={onCreateCustomer}>
          <input
            className="tablet-field__control"
            value={newCustomerName}
            onChange={(event) => setNewCustomerName(event.target.value)}
            placeholder="Novo cliente"
            aria-label="Nome do novo cliente"
          />
          <button type="submit" className="btn btn--secondary tablet-field__btn" disabled={saving}>
            Cadastrar
          </button>
        </form>
      </section>

      <section className="dash-panel">
        <h2 className="dash-panel__title">Itens</h2>
        <div className="tablet-field__stack">
          <label htmlFor="tablet-variant">Produto</label>
          <select
            id="tablet-variant"
            className="tablet-field__control"
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} ({option.quantity})
              </option>
            ))}
          </select>
          <div className="tablet-field__grid3">
            <div>
              <label htmlFor="tablet-qty">Qtd</label>
              <input
                id="tablet-qty"
                className="tablet-field__control"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="tablet-price">Preco</label>
              <input
                id="tablet-price"
                className="tablet-field__control"
                inputMode="decimal"
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                  if (event.target.value.trim()) setPriceMissing(false);
                }}
                placeholder="0,00"
              />
              {priceMissing ? (
                <p className="field-hint">Sem valor na ficha. Informe o preço.</p>
              ) : null}
            </div>
            <div>
              <label htmlFor="tablet-discount">Desc. %</label>
              <input
                id="tablet-discount"
                className="tablet-field__control"
                inputMode="decimal"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
              />
            </div>
          </div>
          <button type="button" className="btn tablet-field__btn" onClick={addLine}>
            Incluir item
          </button>
        </div>
        {draftLines.length === 0 ? (
          <p className="field-hint">Nenhum item ainda.</p>
        ) : (
          <ul className="list-plain tablet-field__lines">
            {draftLines.map((line, index) => {
              const option = options.find((row) => row.id === line.variantId);
              return (
                <li key={`${line.variantId}-${index}`}>
                  <span>
                    {option?.label ?? line.variantId} · {line.quantity} · R${' '}
                    {line.price} · {line.discount}%
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost tablet-field__btn"
                    onClick={() => removeLine(index)}
                  >
                    Tirar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="dash-panel">
        <h2 className="dash-panel__title">Fechar visita</h2>
        <form className="tablet-field__stack" onSubmit={onSubmit}>
          <label htmlFor="tablet-date">Data</label>
          <input
            id="tablet-date"
            type="date"
            className="tablet-field__control"
            value={visitedAt}
            onChange={(event) => setVisitedAt(event.target.value)}
          />
          <label htmlFor="tablet-summary">O que foi falado (opcional)</label>
          <textarea
            id="tablet-summary"
            className="tablet-field__control"
            rows={3}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Orcamento montado em visita."
          />
          <label htmlFor="tablet-next">Proxima acao (opcional)</label>
          <input
            id="tablet-next"
            className="tablet-field__control"
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            placeholder="Retornar com amostra"
          />
          <button type="submit" className="btn tablet-field__btn tablet-field__btn--primary" disabled={saving}>
            {saving ? 'Enviando…' : 'Enviar orcamento e registrar visita'}
          </button>
        </form>
      </section>
    </div>
  );
}
