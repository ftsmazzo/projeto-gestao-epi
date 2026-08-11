'use client';

import type { PortalCustosDashboardResponse } from '@gestao-epi/shared';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { StockDashboardKpis } from '../../../components/portal/StockDashboardKpis';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import {
  fetchPortalCustos,
  uploadPortalInvoice,
} from '../../../lib/client-auth';

function formatBrl(cents: number | null | undefined) {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

function PortalCustosContent() {
  const [data, setData] = useState<PortalCustosDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');

  async function reload() {
    const res = await fetchPortalCustos();
    setData(res);
    return res;
  }

  useEffect(() => {
    let cancelled = false;
    void reload()
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Falha ao carregar custos.',
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useMemo(() => {
    if (!data) return [];
    const s = data.summary;
    return [
      {
        id: 'stock',
        label: 'Valor em estoque',
        value: formatBrl(s.stockValueCents),
        hint:
          s.unpricedBalanceLines > 0
            ? `${s.unpricedBalanceLines} linha(s) sem preco`
            : 'Com base no preco de referencia',
        tone: s.unpricedBalanceLines > 0 ? ('warn' as const) : ('ok' as const),
      },
      {
        id: 'purchased',
        label: 'Compras (entradas)',
        value: formatBrl(s.purchasedCents),
        hint: `${s.purchasedQty} un. valorizadas`,
      },
      {
        id: 'delivered',
        label: 'Entregas valorizadas',
        value: formatBrl(s.deliveredCents),
        hint: `${s.deliveredQty} un. liquidas`,
      },
      {
        id: 'invoices',
        label: 'Notas anexadas',
        value: s.invoiceCount,
        hint: data.ocr.available
          ? 'OCR ativo'
          : 'Anexo ok · OCR em breve',
      },
    ];
  }, [data]);

  async function onUploadInvoice(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await uploadPortalInvoice({
        file,
        number: invoiceNumber,
        supplierName,
      });
      setSuccess(
        `Nota anexada (${res.id.slice(0, 8)}…). Na entrada de estoque, use o ID se quiser vincular.`,
      );
      setInvoiceNumber('');
      setSupplierName('');
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao anexar nota fiscal.',
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="portal-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Painel do Cliente</p>
          <h1 className="page-title">Custos</h1>
          <p className="page-lead">
            Preco por EPI, totais por item, setor e funcao. Informe o valor na
            entrada de estoque.
          </p>
        </div>
        <div className="btn-row">
          <Link href="/portal/estoque" className="btn btn-primary">
            Entrada com valor
          </Link>
        </div>
      </header>

      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      {loading ? <p className="field-hint">Carregando custos...</p> : null}

      {!loading && data ? (
        <>
          <StockDashboardKpis items={kpis} />

          <p className="field-hint" style={{ marginTop: '0.75rem' }}>
            {data.ocr.message}
          </p>

          <div className="dash-panel-grid" style={{ marginTop: '1.25rem' }}>
            <section className="dash-panel" aria-labelledby="custos-epi-title">
              <h2 id="custos-epi-title" className="dash-panel__title">
                Por EPI
              </h2>
              {data.byEpi.length === 0 ? (
                <p className="field-hint">
                  Ainda sem movimentos valorizados. Registre entradas com preco
                  em Estoque.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">EPI</th>
                        <th scope="col">Preco un.</th>
                        <th scope="col">Estoque</th>
                        <th scope="col">Compras</th>
                        <th scope="col">Entregas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byEpi.slice(0, 40).map((row) => (
                        <tr key={row.epiItemId}>
                          <td>
                            <strong>{row.name}</strong>
                            <span className="table-sub">
                              {row.caNumber ? `CA ${row.caNumber}` : 'Sem CA'}
                            </span>
                          </td>
                          <td className="mono">
                            {formatBrl(row.unitPriceCents)}
                          </td>
                          <td>
                            <span className="mono">{row.qtyInStock}</span>
                            <span className="table-sub">
                              {formatBrl(row.stockValueCents)}
                            </span>
                          </td>
                          <td>
                            <span className="mono">{row.qtyPurchased}</span>
                            <span className="table-sub">
                              {formatBrl(row.purchaseCostCents)}
                            </span>
                          </td>
                          <td>
                            <span className="mono">{row.qtyDelivered}</span>
                            <span className="table-sub">
                              {formatBrl(row.deliveryCostCents)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section
              className="dash-panel"
              aria-labelledby="custos-setor-title"
            >
              <h2 id="custos-setor-title" className="dash-panel__title">
                Por setor
              </h2>
              {data.bySector.length === 0 ? (
                <p className="field-hint">Sem entregas valorizadas por setor.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Setor</th>
                        <th scope="col">Qtd</th>
                        <th scope="col">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bySector.map((row) => (
                        <tr key={row.id || row.name}>
                          <td>{row.name}</td>
                          <td className="mono">{row.qty}</td>
                          <td className="mono">{formatBrl(row.costCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="dash-panel" aria-labelledby="custos-job-title">
              <h2 id="custos-job-title" className="dash-panel__title">
                Por funcao
              </h2>
              {data.byJobFunction.length === 0 ? (
                <p className="field-hint">
                  Sem entregas valorizadas por funcao.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Funcao</th>
                        <th scope="col">Qtd</th>
                        <th scope="col">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byJobFunction.map((row) => (
                        <tr key={row.id || row.name}>
                          <td>{row.name}</td>
                          <td className="mono">{row.qty}</td>
                          <td className="mono">{formatBrl(row.costCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <section
            className="dash-panel"
            style={{ marginTop: '1.25rem' }}
            aria-labelledby="custos-compras-title"
          >
            <h2 id="custos-compras-title" className="dash-panel__title">
              Ultimas entradas
            </h2>
            {data.recentPurchases.length === 0 ? (
              <p className="field-hint">Nenhuma entrada registrada ainda.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Quando</th>
                      <th scope="col">EPI</th>
                      <th scope="col">Qtd</th>
                      <th scope="col">Unitario</th>
                      <th scope="col">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentPurchases.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDate(row.createdAt)}</td>
                        <td>
                          <strong>{row.epiName}</strong>
                          <span className="table-sub">
                            {row.caNumber ? `CA ${row.caNumber}` : '—'}
                          </span>
                        </td>
                        <td className="mono">{row.quantity}</td>
                        <td className="mono">
                          {formatBrl(row.unitCostCents)}
                        </td>
                        <td className="mono">
                          {formatBrl(row.totalCostCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section
            className="dash-panel"
            style={{ marginTop: '1.25rem' }}
            aria-labelledby="custos-nota-title"
          >
            <h2 id="custos-nota-title" className="dash-panel__title">
              Anexar nota (foto ou PDF)
            </h2>
            <p className="page-lead">
              Guarde o comprovante agora. A leitura automatica de valores e
              quantidades vem depois.
            </p>
            <div className="form-panel" style={{ maxWidth: 480 }}>
              <div className="field">
                <label htmlFor="invoice-number">Numero da nota (opcional)</label>
                <input
                  id="invoice-number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ex.: 12345"
                />
              </div>
              <div className="field">
                <label htmlFor="invoice-supplier">Fornecedor (opcional)</label>
                <input
                  id="invoice-supplier"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Ex.: Distribuidora XYZ"
                />
              </div>
              <div className="field">
                <label htmlFor="invoice-file">Arquivo</label>
                <input
                  id="invoice-file"
                  type="file"
                  accept="image/*,application/pdf"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    void onUploadInvoice(file);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
            {data.invoices.length > 0 ? (
              <ul className="field-hint" style={{ marginTop: '1rem' }}>
                {data.invoices.map((doc) => (
                  <li key={doc.id}>
                    {doc.number ? `NF ${doc.number}` : 'Anexo'} ·{' '}
                    {doc.supplierName || 'sem fornecedor'} ·{' '}
                    {formatDate(doc.createdAt)}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function PortalCustosPage() {
  return (
    <RequireClientAuth>
      {() => <PortalCustosContent />}
    </RequireClientAuth>
  );
}
