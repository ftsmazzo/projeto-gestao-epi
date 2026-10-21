'use client';

import { FormEvent, useEffect, useState } from 'react';
import { fetchMe } from '../../../lib/auth';
import {
  approveQuote,
  createQuote,
  discountReport,
  getMySellerCeiling,
  isDistributorManager,
  listDistributorProducts,
  listQuotes,
  listSellers,
  parseReaisToCents,
  rejectQuote,
  setSellerCeiling,
  variantCatalogPrice,
  type DistributorProduct,
  type DistributorQuote,
  type MySellerCeiling,
  type QuoteStatus,
  type SellerCeiling,
} from '../../../lib/distributor';

const STATUS_LABEL: Record<QuoteStatus, string> = {
  PENDING_APPROVAL: 'Aguardando gestor',
  APPROVED: 'Liberado',
  REJECTED: 'Recusado',
};

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

function ceilingLabel(ceiling: MySellerCeiling | null) {
  return (ceiling?.maxDiscountPercent ?? 0).toLocaleString('pt-BR');
}

export default function DistribuidoraOrcamentosPage() {
  const [products, setProducts] = useState<DistributorProduct[]>([]);
  const [sellers, setSellers] = useState<SellerCeiling[]>([]);
  const [quotes, setQuotes] = useState<DistributorQuote[]>([]);
  const [manager, setManager] = useState(false);
  const [ceiling, setCeiling] = useState<MySellerCeiling | null>(null);
  const [priceMissing, setPriceMissing] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('0');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [ceilingUserId, setCeilingUserId] = useState('');
  const [ceilingPercent, setCeilingPercent] = useState('0');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reportTotal, setReportTotal] = useState<number | null>(null);
  const [reportRows, setReportRows] = useState<DistributorQuote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const options = products.flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      label: `${product.name} · ${variant.label}`,
    })),
  );
  const sellerName = new Map(sellers.map((seller) => [seller.userId, seller.name]));

  async function reload() {
    const [orderRows, sellerRows] = await Promise.all([listQuotes(), listSellers()]);
    setQuotes(orderRows);
    setSellers(sellerRows);
  }

  useEffect(() => {
    void Promise.all([
      listDistributorProducts(),
      listQuotes(),
      listSellers(),
      getMySellerCeiling(),
      fetchMe(),
    ])
      .then(([productRows, quoteRows, sellerRows, ceilingRow, me]) => {
        setProducts(productRows);
        setQuotes(quoteRows);
        setSellers(sellerRows);
        setCeiling(ceilingRow);
        setManager(isDistributorManager(me.membershipRole));
        const first = productRows[0]?.variants[0]?.id;
        if (first) setVariantId(first);
        if (sellerRows[0]) setCeilingUserId(sellerRows[0].userId);
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
          ? 'Informe o preço unitário com um valor válido. Exemplo: 12,50.'
          : 'Este produto não tem valor cadastrado. Informe o preço unitário ou complete o custo na ficha do produto.',
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
        price,
        discount: String(discountPercent),
      },
    ]);
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (draftLines.length === 0) {
      setError('Inclua ao menos um item no orcamento.');
      return;
    }
    setSaving(true);
    try {
      const created = await createQuote({
        customerName,
        lines: draftLines.map((line) => ({
          variantId: line.variantId,
          quantity: Number(line.quantity),
          unitPriceCents: parseReaisToCents(line.price) ?? 0,
          discountPercent: Number(line.discount),
        })),
      });
      setCustomerName('');
      setDraftLines([]);
      const teto = ceilingLabel(ceiling);
      setNotice(
        created.status === 'APPROVED'
          ? `Orçamento liberado. O desconto ficou dentro do seu teto de ${teto}%.`
          : `Orçamento aguardando um gestor. O desconto passou do seu teto de ${teto}%.`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gravar o orcamento.');
    } finally {
      setSaving(false);
    }
  }

  async function onCeiling(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const rows = await setSellerCeiling(
        ceilingUserId,
        Number(ceilingPercent.replace(',', '.')),
      );
      setSellers(rows);
      setNotice('Teto do vendedor atualizado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar o teto.');
    } finally {
      setSaving(false);
    }
  }

  async function act(quoteId: string, action: 'approve' | 'reject') {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      if (action === 'approve') await approveQuote(quoteId);
      else await rejectQuote(quoteId);
      setNotice(
        action === 'approve'
          ? 'Orcamento aprovado. O desconto entra no relatorio.'
          : 'Orcamento recusado. Esse desconto nao entra no relatorio.',
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar o orcamento.');
    } finally {
      setSaving(false);
    }
  }

  async function onReport(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const report = await discountReport(from, to);
      setReportTotal(report.grantedCents);
      setReportRows(report.quotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no relatorio.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Distribuidora</p>
          <h1 className="page-title">Orcamentos</h1>
          <p className="page-lead">
            Desconto dentro do teto do vendedor segue. Acima do teto, um gestor
            aprova. O relatorio mostra quanto foi concedido no periodo.
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
        <form className="form dash-panel" onSubmit={onCeiling}>
          <h2 className="dash-panel__title">Teto por vendedor</h2>
          <div className="field">
            <label htmlFor="vendedor">Vendedor</label>
            <select
              id="vendedor"
              value={ceilingUserId}
              onChange={(event) => {
                const userId = event.target.value;
                setCeilingUserId(userId);
                const seller = sellers.find((item) => item.userId === userId);
                if (seller) setCeilingPercent(String(seller.maxDiscountBps / 100));
              }}
            >
              {sellers.map((seller) => (
                <option key={seller.userId} value={seller.userId}>
                  {seller.name} · teto {seller.maxDiscountBps / 100}%
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="teto">Teto de desconto (%)</label>
            <input
              id="teto"
              inputMode="decimal"
              value={ceilingPercent}
              onChange={(event) => setCeilingPercent(event.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            Salvar teto
          </button>
        </form>
      ) : null}
      <form className="form dash-panel" onSubmit={onCreate}>
        <h2 className="dash-panel__title">Novo orcamento</h2>
        <div className="field">
          <label htmlFor="cliente">Cliente</label>
          <input
            id="cliente"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            required
            minLength={2}
          />
        </div>
        <div className="field">
          <label htmlFor="item-orcamento">Item</label>
          <select
            id="item-orcamento"
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="qtd-orcamento">Quantidade</label>
          <input
            id="qtd-orcamento"
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="preco">Preço unitário (R$)</label>
          <input
            id="preco"
            inputMode="decimal"
            value={price}
            onChange={(event) => {
              setPrice(event.target.value);
              if (event.target.value.trim()) setPriceMissing(false);
            }}
          />
          {priceMissing ? (
            <p className="field-hint">
              Este produto não tem valor cadastrado. Informe o preço ou complete o
              custo na ficha do produto.
            </p>
          ) : (
            <p className="field-hint">
              Valor puxado do custo do produto. Você pode alterar antes de incluir.
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="desconto">Desconto (%)</label>
          <input
            id="desconto"
            inputMode="decimal"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
          />
          <p className="field-hint">
            Seu teto de desconto é {ceilingLabel(ceiling)}%. Acima disso o orçamento
            fica aguardando um gestor.
          </p>
        </div>
        <button className="btn" type="button" onClick={addLine}>
          Incluir item
        </button>
        {draftLines.length > 0 ? (
          <ul>
            {draftLines.map((line, index) => (
              <li key={`${line.variantId}-${index}`}>
                {options.find((option) => option.id === line.variantId)?.label} ·{' '}
                {line.quantity} · R$ {line.price} · {line.discount}%
              </li>
            ))}
          </ul>
        ) : null}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          Gravar orcamento
        </button>
      </form>
      <section className="dash-panel">
        <h2 className="dash-panel__title">Orcamentos</h2>
        {quotes.length === 0 ? (
          <p className="field-hint">Nenhum orcamento.</p>
        ) : (
          quotes.map((quote) => (
            <article key={quote.id} className="dash-panel">
              <h3 className="dash-panel__title">{quote.customerName}</h3>
              <p className="field-hint">
                {STATUS_LABEL[quote.status]} · {sellerName.get(quote.sellerUserId) ?? 'Vendedor'} · deixou de ganhar {money(quote.grantedCents)}
              </p>
              <ul>
                {quote.lines.map((line) => (
                  <li key={line.id}>
                    {line.productName} · {line.label} · {line.quantity} ·{' '}
                    {money(line.unitPriceCents)} · {line.discountBps / 100}%
                  </li>
                ))}
              </ul>
              {manager && quote.status === 'PENDING_APPROVAL' ? (
                <div className="form-actions">
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={saving}
                    onClick={() => void act(quote.id, 'approve')}
                  >
                    Aprovar
                  </button>
                  <button
                    className="btn"
                    type="button"
                    disabled={saving}
                    onClick={() => void act(quote.id, 'reject')}
                  >
                    Recusar
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>
      <form className="form dash-panel" onSubmit={onReport}>
        <h2 className="dash-panel__title">Desconto concedido</h2>
        <div className="field">
          <label htmlFor="de">De</label>
          <input id="de" type="date" value={from} onChange={(event) => setFrom(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="ate">Ate</label>
          <input id="ate" type="date" value={to} onChange={(event) => setTo(event.target.value)} required />
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          Ver periodo
        </button>
        {reportTotal != null ? (
          <p className="field-hint">
            No periodo, os orcamentos aprovados deixaram de ganhar {money(reportTotal)}.
            {reportRows.length === 0 ? ' Nenhum orcamento aprovado nesse intervalo.' : ''}
          </p>
        ) : null}
      </form>
    </div>
  );
}
