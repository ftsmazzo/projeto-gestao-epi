'use client';

import type {
  CaCertificateSearchItem,
  PortalEstoqueResponse,
  PortalInvoiceExtraction,
  PortalInvoiceExtractionLine,
  PortalReportsActivityResponse,
  PortalReportsStockResponse,
  PortalStockBalanceRow,
} from '@gestao-epi/shared';
import {
  assessNeedEquipmentCompatibility,
  preferredCaepiQuery,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { StockConsumptionCharts } from '../../../components/portal/StockConsumptionCharts';
import { StockDashboardKpis } from '../../../components/portal/StockDashboardKpis';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import {
  caStatusClassName,
  formatCaStatusLabel,
} from '../../../lib/caepi-assist';
import {
  createPortalStockEntradas,
  fetchPortalEstoque,
  fetchPortalReportsActivity,
  fetchPortalReportsStock,
  searchPortalCaepi,
  uploadPortalInvoice,
} from '../../../lib/client-auth';

const SEARCH_MIN = 3;
const SEARCH_DEBOUNCE_MS = 350;

/** Converte "12,50" / "12.50" em centavos. Vazio = undefined. */
function caDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

function parseReaisToCents(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const normalized = t.includes(',')
    ? t.replace(/\./g, '').replace(',', '.')
    : t;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

function centsToReaisInput(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

function normalizeInvoiceKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchInvoiceLine(
  extraction: PortalInvoiceExtraction | null | undefined,
  hint: { caNumber?: string | null; description?: string | null },
): PortalInvoiceExtractionLine | null {
  const lines = extraction?.lines ?? [];
  if (lines.length === 0) return null;
  const ca = hint.caNumber?.replace(/\D/g, '') ?? '';
  if (ca) {
    const byCa = lines.find((line) => line.caNumber === ca);
    if (byCa) return byCa;
  }
  const tokens = normalizeInvoiceKey(hint.description ?? '')
    .split(' ')
    .filter((token) => token.length >= 4);
  if (tokens.length > 0) {
    let best: PortalInvoiceExtractionLine | null = null;
    let score = 0;
    for (const line of lines) {
      const desc = normalizeInvoiceKey(line.description);
      const hit = tokens.filter((token) => desc.includes(token)).length;
      if (hit > score) {
        score = hit;
        best = line;
      }
    }
    if (best && score > 0) return best;
  }
  return lines.length === 1 ? lines[0] : null;
}

const CAEPI_PICKER_LIMIT = 50;

function sortSuggestionsForNeed(
  needName: string,
  items: CaCertificateSearchItem[],
) {
  return [...items].sort((a, b) => {
    const aOk = assessNeedEquipmentCompatibility(needName, a.equipmentName)
      .compatible
      ? 0
      : 1;
    const bOk = assessNeedEquipmentCompatibility(needName, b.equipmentName)
      .compatible
      ? 0
      : 1;
    return aOk - bOk;
  });
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

function CaepiSuggestionButton({
  item,
  onSelect,
}: {
  item: CaCertificateSearchItem;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="caepi-suggest-item" onClick={onSelect}>
      <span className="caepi-suggest-item__top">
        <span className="caepi-suggest-item__ca">CA {item.caNumber}</span>
        <span className={caStatusClassName(item.status)}>
          {formatCaStatusLabel(item.status)}
        </span>
      </span>
      <span className="caepi-suggest-item__name">
        {item.equipmentName || 'Equipamento nao informado'}
      </span>
      <span className="caepi-suggest-item__meta">
        {[
          item.manufacturerName,
          item.reference ? `Ref. ${item.reference}` : null,
          `Val. ${formatDate(item.expiresAt)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </button>
  );
}

type NeedRow = {
  needId: string;
  needName: string;
  jobNames: string[];
  quantity: number;
  /** Preco unitario em reais (texto livre, ex.: 12,50). */
  unitPriceReais: string;
  selected: boolean;
  picked: CaCertificateSearchItem | null;
  picking: boolean;
  pickerQuery: string;
  suggestions: CaCertificateSearchItem[];
  suggestLoading: boolean;
  suggestMessage: string | null;
};

function buildNeedRows(data: PortalEstoqueResponse): NeedRow[] {
  return data.needs.map((need) => {
    const linked = need.items[0];
    const picked: CaCertificateSearchItem | null = linked?.caNumber
      ? {
          caNumber: linked.caNumber,
          status: 'VALIDO',
          expiresAt: linked.caExpiresAt,
          equipmentName: linked.name,
          manufacturerName: null,
          reference: null,
          color: null,
          sourceImportedAt: null,
        }
      : null;
    return {
      needId: need.needId,
      needName: need.needName,
      jobNames: need.jobNames,
      quantity: need.suggestedQuantity || 1,
      unitPriceReais: '',
      selected: Boolean(picked),
      picked,
      picking: false,
      pickerQuery: preferredCaepiQuery(need.needName),
      suggestions: [],
      suggestLoading: false,
      suggestMessage: null,
    };
  });
}

function balanceStatus(row: PortalStockBalanceRow): {
  key: 'ok' | 'baixo' | 'zerado';
  label: string;
} {
  if (row.quantity <= 0) return { key: 'zerado', label: 'Zerado' };
  if (row.minQuantity != null && row.quantity <= row.minQuantity) {
    return { key: 'baixo', label: 'Baixo' };
  }
  return { key: 'ok', label: 'OK' };
}

function PortalEstoqueContent() {
  const [data, setData] = useState<PortalEstoqueResponse | null>(null);
  const [stockReport, setStockReport] =
    useState<PortalReportsStockResponse | null>(null);
  const [activityReport, setActivityReport] =
    useState<PortalReportsActivityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'dashboard' | 'entrada'>('dashboard');

  const [needRows, setNeedRows] = useState<NeedRow[]>([]);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CaCertificateSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [picked, setPicked] = useState<CaCertificateSearchItem | null>(null);
  const [freeQty, setFreeQty] = useState(1);
  const [freeUnitPriceReais, setFreeUnitPriceReais] = useState('');
  const [freeMode, setFreeMode] = useState<'manual' | 'invoice'>('manual');
  const [batchInvoiceFile, setBatchInvoiceFile] = useState<File | null>(null);
  const [freeInvoiceFile, setFreeInvoiceFile] = useState<File | null>(null);
  const needSearchTimers = useRef<Record<string, number>>({});

  async function reload() {
    const [res, stock, activity] = await Promise.all([
      fetchPortalEstoque(),
      fetchPortalReportsStock().catch(() => null),
      fetchPortalReportsActivity().catch(() => null),
    ]);
    setData(res);
    setStockReport(stock);
    setActivityReport(activity);
    setNeedRows(buildNeedRows(res));
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
            err instanceof Error ? err.message : 'Falha ao carregar estoque.',
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Entrada avulsa: busca CAEPI igual ao catalogo mestre
  useEffect(() => {
    if (picked) return;
    const q = query.trim();
    if (q.length < SEARCH_MIN) {
      setSuggestions([]);
      setSearching(false);
      setSearchMessage(
        q.length > 0 ? `Digite mais ${SEARCH_MIN - q.length} letra(s)...` : null,
      );
      return;
    }
    setSearching(true);
    setSearchMessage(null);
    const handle = window.setTimeout(() => {
      void searchPortalCaepi(
        q,
        /^\d{3,}$/.test(caDigits(q)) ? 5 : 15,
        /^\d{3,}$/.test(caDigits(q)) ? undefined : { validOnly: true },
      )
        .then((res) => {
          setSuggestions(res.items);
          setSearchMessage(
            res.items.length === 0
              ? res.message ??
                'Nenhum CA encontrado. Digite o numero completo e inclua mesmo assim.'
              : res.message,
          );
        })
        .catch((err: unknown) => {
          setSuggestions([]);
          setSearchMessage(
            err instanceof Error ? err.message : 'Falha ao buscar na base CAEPI.',
          );
        })
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query, picked]);

  const selectedNeedCount = useMemo(
    () =>
      needRows.filter((row) => row.selected && row.picked && row.quantity > 0)
        .length,
    [needRows],
  );
  const pickingIndex = needRows.findIndex((row) => row.picking);
  const pickingRow = pickingIndex >= 0 ? needRows[pickingIndex] : null;

  async function loadNeedSuggestions(index: number, q: string) {
    const query = q.trim();
    if (query.length < SEARCH_MIN) {
      setNeedRows((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                suggestLoading: false,
                suggestions: [],
                suggestMessage: `Digite ao menos ${SEARCH_MIN} caracteres.`,
              }
            : r,
        ),
      );
      return;
    }
    setNeedRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, suggestLoading: true, suggestMessage: null }
          : r,
      ),
    );
    try {
      const needName = needRows[index]?.needName ?? query;
      const isCaNumber = /^\d{3,}$/.test(caDigits(query));
      const searchTerm = query;
      let res = await searchPortalCaepi(searchTerm, CAEPI_PICKER_LIMIT, {
        validOnly: !isCaNumber,
      });
      let items = res.items;
      if (items.length === 0 && !isCaNumber) {
        const fallback = preferredCaepiQuery(needName);
        if (fallback.toLowerCase() !== searchTerm.toLowerCase()) {
          res = await searchPortalCaepi(fallback, CAEPI_PICKER_LIMIT, {
            validOnly: true,
          });
          items = res.items;
        }
      }
      items = isCaNumber ? items : sortSuggestionsForNeed(needName, items);
      const incomplete =
        res.message && /incompleta|nao importada/i.test(res.message)
          ? res.message
          : null;
      setNeedRows((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                suggestLoading: false,
                suggestions: items,
                suggestMessage:
                  items.length === 0
                    ? res.message ??
                      `Nenhum CA para "${searchTerm}". Digite o numero do CA.`
                    : incomplete ??
                      (isCaNumber
                        ? null
                        : `Mostrando ${items.length} CA(s) correlacionados (limite ${CAEPI_PICKER_LIMIT}). Digite o numero do CA se o seu ficou de fora.`),
              }
            : r,
        ),
      );
    } catch (err) {
      setNeedRows((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                suggestLoading: false,
                suggestions: [],
                suggestMessage:
                  err instanceof Error
                    ? err.message
                    : 'Falha ao buscar EPIs na base.',
              }
            : r,
        ),
      );
    }
  }

  function openNeedPicker(index: number) {
    const row = needRows[index];
    if (!row) return;
    const initialQ = preferredCaepiQuery(row.needName);
    setNeedRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              picking: true,
              pickerQuery: initialQ,
              suggestLoading: true,
              suggestMessage: null,
              suggestions: [],
            }
          : { ...r, picking: false },
      ),
    );
    void loadNeedSuggestions(index, initialQ);
    window.requestAnimationFrame(() => {
      document.getElementById('need-caepi-associate')?.focus();
      document
        .getElementById('caepi-associate-form')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function closeNeedPicker() {
    setNeedRows((prev) =>
      prev.map((r) => ({
        ...r,
        picking: false,
        suggestions: [],
        suggestLoading: false,
      })),
    );
  }

  function resetNeedPickerToCorrelated(index: number) {
    const row = needRows[index];
    if (!row) return;
    const initialQ = preferredCaepiQuery(row.needName);
    setNeedRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, pickerQuery: initialQ, suggestLoading: true }
          : r,
      ),
    );
    void loadNeedSuggestions(index, initialQ);
  }

  function pickForNeed(index: number, cert: CaCertificateSearchItem) {
    setNeedRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const check = assessNeedEquipmentCompatibility(
          r.needName,
          cert.equipmentName,
        );
        return {
          ...r,
          picked: cert,
          selected: true,
          picking: false,
          suggestions: [],
          suggestMessage: check.compatible
            ? null
            : `CA ${cert.caNumber}: ${check.reason} Confira se e o EPI certo.`,
        };
      }),
    );
  }

  async function onBatchEntrada() {
    const items = needRows
      .filter((row) => row.selected && row.picked && row.quantity > 0)
      .map((row) => ({
        epiNeedId: row.needId,
        caNumber: row.picked!.caNumber,
        quantity: row.quantity,
        unitCostCents: parseReaisToCents(row.unitPriceReais),
        needName: row.needName,
      }));
    if (items.length === 0) {
      setError('Selecione o EPI (CA) de cada necessidade que deseja incluir.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      let invoiceDocumentId: string | undefined;
      let extraction: PortalInvoiceExtraction | undefined;
      if (batchInvoiceFile) {
        const uploaded = await uploadPortalInvoice({ file: batchInvoiceFile });
        invoiceDocumentId = uploaded.id;
        extraction = uploaded.extraction;
      }
      const payload = items.map(
        ({ epiNeedId, caNumber, quantity, unitCostCents, needName }) => {
          const matched = matchInvoiceLine(extraction, {
            caNumber,
            description: needName,
          });
          return {
            epiNeedId,
            caNumber,
            quantity: matched?.quantity ?? quantity,
            unitCostCents: unitCostCents ?? matched?.unitCostCents ?? undefined,
            ...(invoiceDocumentId ? { invoiceDocumentId } : {}),
          };
        },
      );
      const result = await createPortalStockEntradas(
        payload.map(
          ({ epiNeedId, caNumber, quantity, unitCostCents, invoiceDocumentId: inv }) => ({
            epiNeedId,
            caNumber,
            quantity,
            ...(unitCostCents != null ? { unitCostCents } : {}),
            ...(inv ? { invoiceDocumentId: inv } : {}),
          }),
        ),
      );
      setSuccess(
        `${result.created} entrada(s) registrada(s)` +
          (invoiceDocumentId ? ' com nota.' : ' sem nota.') +
          (() => {
            const linked = result.items
              .flatMap((row) => row.linkedNeedNames ?? [])
              .filter((name, index, all) => all.indexOf(name) === index);
            return linked.length > 0 ? ` Vinculado a: ${linked.join(', ')}.` : '';
          })(),
      );
      setBatchInvoiceFile(null);
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao registrar entradas.',
      );
    } finally {
      setSaving(false);
    }
  }

  function resolveFreeCaNumber(): string | null {
    if (picked?.caNumber) return picked.caNumber;
    const typed = caDigits(query);
    if (typed.length < 3) return null;
    const exact = suggestions.find(
      (item) => caDigits(item.caNumber) === typed,
    );
    return exact?.caNumber ?? typed;
  }

  async function onFreeEntrada(event: FormEvent) {
    event.preventDefault();
    const caNumber = resolveFreeCaNumber();
    if (!caNumber) {
      setError('Informe o numero do CA (ou escolha um resultado da lista).');
      return;
    }
    if (freeMode === 'invoice' && !freeInvoiceFile) {
      setError('No fluxo com nota, anexe o PDF ou a foto da NF.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      let invoiceDocumentId: string | undefined;
      let unitCostCents = parseReaisToCents(freeUnitPriceReais);
      let qty = freeQty;
      if (freeMode === 'invoice' && freeInvoiceFile) {
        const uploaded = await uploadPortalInvoice({ file: freeInvoiceFile });
        invoiceDocumentId = uploaded.id;
        const matched = matchInvoiceLine(uploaded.extraction, {
          caNumber,
          description: picked?.equipmentName ?? query,
        });
        if (unitCostCents == null && matched?.unitCostCents != null) {
          unitCostCents = matched.unitCostCents;
          setFreeUnitPriceReais(centsToReaisInput(matched.unitCostCents));
        }
        if (matched?.quantity != null && matched.quantity > 0) {
          qty = matched.quantity;
          setFreeQty(matched.quantity);
        }
      }
      const result = await createPortalStockEntradas([
        {
          caNumber,
          quantity: qty,
          ...(unitCostCents != null ? { unitCostCents } : {}),
          ...(invoiceDocumentId ? { invoiceDocumentId } : {}),
        },
      ]);
      const linked = result.items
        .flatMap((row) => row.linkedNeedNames ?? [])
        .filter((name, index, all) => all.indexOf(name) === index);
      setSuccess(
        `Entrada de ${qty} un. (CA ${caNumber}) registrada` +
          (invoiceDocumentId ? ' com nota' : '') +
          (linked.length > 0
            ? ` e vinculada a: ${linked.join(', ')}.`
            : '. Confira se a necessidade do PGR combina com este CA.'),
      );
      setPicked(null);
      setQuery('');
      setSuggestions([]);
      setFreeQty(1);
      setFreeUnitPriceReais('');
      setFreeInvoiceFile(null);
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao registrar entrada.',
      );
    } finally {
      setSaving(false);
    }
  }

  const kpiItems = useMemo(() => {
    const summary = stockReport?.summary;
    return [
      {
        id: 'units',
        label: 'Unidades em saldo',
        value: data?.summary.totalUnits ?? 0,
        hint: data?.location.name ? `Local: ${data.location.name}` : undefined,
      },
      {
        id: 'ok',
        label: 'Linhas OK',
        value: summary?.ok ?? 0,
        tone: 'ok' as const,
        hint: `${summary?.total ?? data?.summary.balanceLines ?? 0} linhas no total`,
      },
      {
        id: 'baixo',
        label: 'Estoque baixo',
        value: summary?.baixo ?? 0,
        tone: (summary?.baixo ?? 0) > 0 ? ('warn' as const) : ('default' as const),
      },
      {
        id: 'zerado',
        label: 'Zerados',
        value: summary?.zerado ?? 0,
        tone:
          (summary?.zerado ?? 0) > 0 ? ('danger' as const) : ('default' as const),
        hint: `${data?.summary.needs ?? 0} necessidades ativas`,
      },
    ];
  }, [data, stockReport]);

  const statusChart = useMemo(() => {
    const s = stockReport?.summary;
    return [
      { name: 'OK', value: s?.ok ?? 0, key: 'ok' as const },
      { name: 'Baixo', value: s?.baixo ?? 0, key: 'baixo' as const },
      { name: 'Zerado', value: s?.zerado ?? 0, key: 'zerado' as const },
    ];
  }, [stockReport]);

  const consumptionChart = useMemo(() => {
    const rows = activityReport?.bySector ?? [];
    return [...rows]
      .sort((a, b) => b.itemsDelivered - a.itemsDelivered)
      .slice(0, 8)
      .map((row) => ({
        name:
          row.sectorName.length > 18
            ? `${row.sectorName.slice(0, 16)}…`
            : row.sectorName,
        items: row.itemsDelivered,
      }));
  }, [activityReport]);

  return (
    <div className="portal-home">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Operacao</p>
          <h1 className="page-title">Estoque</h1>
          <p className="page-lead">
            Visao de saldos, consumo recente e entrada via base CAEPI.
          </p>
        </div>
        <div className="dash-page-header__actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setView('entrada')}
          >
            Registrar entrada
          </button>
          <Link className="btn btn-secondary" href="/portal/entregas">
            Ir para entregas
          </Link>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="notice notice--ok" role="status">
          {success}
        </p>
      ) : null}
      {loading ? <p className="page-lead">Carregando estoque...</p> : null}

      {data ? (
        <>
          <div
            className="portal-section-tabs portal-section-tabs--dash"
            role="tablist"
            aria-label="Visoes do estoque"
          >
            <button
              type="button"
              role="tab"
              className={`portal-section-tab ${view === 'dashboard' ? 'is-active' : ''}`}
              aria-selected={view === 'dashboard'}
              onClick={() => setView('dashboard')}
            >
              Visao geral
            </button>
            <button
              type="button"
              role="tab"
              className={`portal-section-tab ${view === 'entrada' ? 'is-active' : ''}`}
              aria-selected={view === 'entrada'}
              onClick={() => setView('entrada')}
            >
              Registrar entrada
            </button>
          </div>

          {view === 'dashboard' ? (
            <>
              <StockDashboardKpis items={kpiItems} />
              <StockConsumptionCharts
                status={statusChart}
                consumption={consumptionChart}
                periodLabel="Ultimos 30 dias"
              />

              <section className="portal-card" aria-labelledby="saldos-title">
                <div className="dash-panel__head">
                  <h2 id="saldos-title">Saldos atuais</h2>
                  <p>
                    Quantidades disponiveis para entrega
                    {data.location.name ? ` · ${data.location.name}` : ''}
                  </p>
                </div>
                <div className="table-wrap">
                  <table className="data-table data-table--refined">
                    <thead>
                      <tr>
                        <th scope="col">EPI</th>
                        <th scope="col">CA</th>
                        <th scope="col">Validade</th>
                        <th scope="col">Status</th>
                        <th scope="col">Qtd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.balances.length === 0 ? (
                        <tr>
                          <td colSpan={5}>
                            Nenhum saldo ainda. Use Registrar entrada para
                            incluir EPIs.
                          </td>
                        </tr>
                      ) : (
                        data.balances.map((row) => {
                          const status = balanceStatus(row);
                          return (
                            <tr key={row.id}>
                              <td>
                                <strong>{row.epiName}</strong>
                                {row.usefulLifeLabel ? (
                                  <span className="table-sub">
                                    Vida util {row.usefulLifeLabel}
                                  </span>
                                ) : null}
                              </td>
                              <td className="mono">{row.caNumber ?? '—'}</td>
                              <td>{formatDate(row.caExpiresAt)}</td>
                              <td>
                                <span
                                  className={`stock-status stock-status--${status.key}`}
                                >
                                  {status.label}
                                </span>
                              </td>
                              <td className="mono">{row.quantity}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <>
          <section className="portal-card" aria-labelledby="entrada-livre-title">
            <h2 id="entrada-livre-title" className="page-title page-title--sm">
              Entrada por CA
            </h2>
            <p className="page-lead">
              Dois caminhos: so CA + quantidade + preco, ou o mesmo com nota
              fiscal anexada. A nota nunca e obrigatoria no primeiro.
            </p>
            <div
              className="portal-section-tabs"
              role="tablist"
              aria-label="Tipo de entrada"
            >
              <button
                type="button"
                role="tab"
                className={`portal-section-tab ${freeMode === 'manual' ? 'is-active' : ''}`}
                aria-selected={freeMode === 'manual'}
                onClick={() => {
                  setFreeMode('manual');
                  setFreeInvoiceFile(null);
                }}
              >
                Sem nota
              </button>
              <button
                type="button"
                role="tab"
                className={`portal-section-tab ${freeMode === 'invoice' ? 'is-active' : ''}`}
                aria-selected={freeMode === 'invoice'}
                onClick={() => setFreeMode('invoice')}
              >
                Com nota fiscal
              </button>
            </div>
            <form className="form-panel" onSubmit={onFreeEntrada}>
              <div className="field">
                <label htmlFor="portal-caepi-search">Numero do CA</label>
                <input
                  id="portal-caepi-search"
                  value={
                    picked
                      ? `CA ${picked.caNumber} — ${picked.equipmentName ?? ''}`
                      : query
                  }
                  onChange={(e) => {
                    setPicked(null);
                    setQuery(e.target.value);
                  }}
                  placeholder="Ex.: 11442 ou protetor facial"
                  autoComplete="off"
                />
                {searching ? <p className="field-hint">Buscando na CAEPI...</p> : null}
                {searchMessage ? (
                  <p className="field-hint">{searchMessage}</p>
                ) : null}
                {!picked && suggestions.length > 0 ? (
                  <ul
                    className="caepi-suggest-list caepi-suggest-list--slot"
                    role="listbox"
                  >
                    {suggestions.map((item) => (
                      <li key={item.caNumber}>
                        <CaepiSuggestionButton
                          item={item}
                          onSelect={() => {
                            setPicked(item);
                            setQuery('');
                            setSuggestions([]);
                            setSearchMessage(null);
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {picked ? (
                <p className="field-hint">
                  Selecionado: <strong>CA {picked.caNumber}</strong> ·{' '}
                  {picked.equipmentName} · Val.{' '}
                  {formatDate(picked.expiresAt)}
                </p>
              ) : null}

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="portal-epi-qty">Quantidade</label>
                  <input
                    id="portal-epi-qty"
                    type="number"
                    min={1}
                    required
                    value={freeQty}
                    onChange={(e) =>
                      setFreeQty(Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="portal-epi-price">Valor unitario (R$)</label>
                  <input
                    id="portal-epi-price"
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex.: 12,50"
                    value={freeUnitPriceReais}
                    onChange={(e) => setFreeUnitPriceReais(e.target.value)}
                  />
                </div>
              </div>
              {freeMode === 'invoice' ? (
                <div className="field">
                  <label htmlFor="portal-epi-invoice">
                    Nota fiscal (PDF ou foto)
                  </label>
                  <input
                    id="portal-epi-invoice"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) =>
                      setFreeInvoiceFile(e.target.files?.[0] ?? null)
                    }
                  />
                </div>
              ) : (
                <p className="field-hint">
                  Sem anexo. O saldo entra so com CA, quantidade e preco.
                </p>
              )}
              <button
                className="btn btn-primary"
                type="submit"
                disabled={
                  saving ||
                  (!picked && caDigits(query).length < 3 && query.trim().length < SEARCH_MIN)
                }
              >
                {saving
                  ? 'Salvando...'
                  : freeMode === 'invoice'
                    ? 'Incluir com nota'
                    : 'Incluir sem nota'}
              </button>
            </form>
          </section>

          <section className="portal-card" aria-labelledby="needs-stock-title">
            <h2 id="needs-stock-title" className="page-title page-title--sm">
              Por necessidade da empresa
            </h2>
            <p className="page-lead">
              Opcional: amarra o CA a uma necessidade do PGR. A nota no rodape
              tambem e opcional — use <strong>Incluir sem nota</strong> se nao
              tiver DANFE.
            </p>

            {needRows.length === 0 ? (
              <p className="page-lead">
                Nenhuma necessidade ativa nesta empresa (PGR/estrutura).
              </p>
            ) : (
              <>
                {pickingRow ? (
                  <form
                    id="caepi-associate-form"
                    className="form-panel caepi-associate-form"
                    onSubmit={(e) => e.preventDefault()}
                  >
                    <h3 className="page-title page-title--sm">
                      Associar CA a {pickingRow.needName}
                    </h3>
                    <p className="page-lead">
                      Lista dos CAs correlacionados a esta indicacao. Se o seu
                      ficou de fora do limite, pesquise pelo nome ou pelo
                      numero do CA.
                    </p>
                    <div className="field">
                      <label htmlFor="need-caepi-associate">
                        Nome do EPI ou numero do CA
                      </label>
                      <input
                        id="need-caepi-associate"
                        value={pickingRow.pickerQuery}
                        onChange={(e) => {
                          const value = e.target.value;
                          const index = pickingIndex;
                          setNeedRows((prev) =>
                            prev.map((r, i) =>
                              i === index ? { ...r, pickerQuery: value } : r,
                            ),
                          );
                          const prevTimer =
                            needSearchTimers.current[pickingRow.needId];
                          if (prevTimer) window.clearTimeout(prevTimer);
                          needSearchTimers.current[pickingRow.needId] =
                            window.setTimeout(() => {
                              void loadNeedSuggestions(index, value);
                            }, SEARCH_DEBOUNCE_MS);
                        }}
                        placeholder="Ex.: botina, luva raspa ou 11442"
                        autoComplete="off"
                      />
                      {pickingRow.suggestLoading ? (
                        <p className="field-hint">Buscando na CAEPI...</p>
                      ) : null}
                      {pickingRow.suggestMessage ? (
                        <p className="field-hint">{pickingRow.suggestMessage}</p>
                      ) : null}
                    </div>
                    {pickingRow.suggestions.length > 0 ? (
                      <ul
                        className="caepi-suggest-list caepi-suggest-list--slot"
                        role="listbox"
                      >
                        {pickingRow.suggestions.map((item) => (
                          <li key={item.caNumber}>
                            <CaepiSuggestionButton
                              item={item}
                              onSelect={() => pickForNeed(pickingIndex, item)}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="btn-row" style={{ marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          resetNeedPickerToCorrelated(pickingIndex)
                        }
                      >
                        Ver correlacionados
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={closeNeedPicker}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : null}
                <div className="table-wrap">
                  <table className="data-table data-table--refined">
                    <thead>
                      <tr>
                        <th scope="col">Incluir</th>
                        <th scope="col">Necessidade</th>
                        <th scope="col">EPI escolhido (base CAEPI)</th>
                        <th scope="col">Qtd</th>
                        <th scope="col">Valor un. (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {needRows.map((row, index) => (
                        <tr key={row.needId}>
                          <td>
                            <input
                              type="checkbox"
                              checked={row.selected && Boolean(row.picked)}
                              disabled={!row.picked}
                              onChange={(e) =>
                                setNeedRows((prev) =>
                                  prev.map((r, i) =>
                                    i === index
                                      ? { ...r, selected: e.target.checked }
                                      : r,
                                  ),
                                )
                              }
                              aria-label={`Incluir ${row.needName}`}
                            />
                          </td>
                          <td>
                            <strong>{row.needName}</strong>
                            {row.jobNames.length > 0 ? (
                              <span className="table-sub">
                                {row.jobNames.join(', ')}
                              </span>
                            ) : null}
                          </td>
                          <td>
                            {row.picked ? (
                              <div>
                                <strong>
                                  CA {row.picked.caNumber} —{' '}
                                  {row.picked.equipmentName ?? row.needName}
                                </strong>
                                <span className="table-sub">
                                  {row.picked.manufacturerName ?? '—'} · Val.{' '}
                                  {formatDate(row.picked.expiresAt)} ·{' '}
                                  {formatCaStatusLabel(row.picked.status)}
                                </span>
                                <div className="btn-row" style={{ marginTop: '0.35rem' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-compact"
                                    onClick={() => void openNeedPicker(index)}
                                  >
                                    Trocar EPI
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secondary btn-compact"
                                onClick={() => void openNeedPicker(index)}
                              >
                                {row.picking
                                  ? 'Selecionando...'
                                  : 'Escolher EPI na base'}
                              </button>
                            )}
                          </td>
                          <td>
                            <input
                              type="number"
                              min={1}
                              className="portal-qty-input"
                              value={row.quantity}
                              disabled={!row.picked}
                              onChange={(e) =>
                                setNeedRows((prev) =>
                                  prev.map((r, i) =>
                                    i === index
                                      ? {
                                          ...r,
                                          quantity: Math.max(
                                            1,
                                            Number(e.target.value) || 1,
                                          ),
                                        }
                                      : r,
                                  ),
                                )
                              }
                              aria-label={`Qtd ${row.needName}`}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="portal-qty-input"
                              placeholder="0,00"
                              value={row.unitPriceReais}
                              disabled={!row.picked}
                              onChange={(e) =>
                                setNeedRows((prev) =>
                                  prev.map((r, i) =>
                                    i === index
                                      ? { ...r, unitPriceReais: e.target.value }
                                      : r,
                                  ),
                                )
                              }
                              aria-label={`Valor unitario ${row.needName}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flow-sticky-bar">
                  <div className="field" style={{ margin: 0, minWidth: 180 }}>
                    <label htmlFor="batch-invoice-file" className="field-hint">
                      Nota (opcional)
                    </label>
                    <input
                      id="batch-invoice-file"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) =>
                        setBatchInvoiceFile(e.target.files?.[0] ?? null)
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setView('dashboard')}
                  >
                    Ver dashboard
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saving || selectedNeedCount === 0}
                    onClick={() => void onBatchEntrada()}
                  >
                    {saving
                      ? 'Salvando...'
                      : batchInvoiceFile
                        ? `Incluir com nota (${selectedNeedCount})`
                        : `Incluir sem nota (${selectedNeedCount})`}
                  </button>
                </div>
              </>
            )}
          </section>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function PortalEstoquePage() {
  return (
    <RequireClientAuth>
      {() => <PortalEstoqueContent />}
    </RequireClientAuth>
  );
}
