'use client';

import type {
  CaCertificateSearchItem,
  PortalEstoqueResponse,
  PortalReportsActivityResponse,
  PortalReportsStockResponse,
  PortalStockBalanceRow,
} from '@gestao-epi/shared';
import { assessNeedEquipmentCompatibility } from '@gestao-epi/shared';
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
} from '../../../lib/client-auth';

const SEARCH_MIN = 3;
const SEARCH_DEBOUNCE_MS = 350;
const STOP_WORDS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'para',
  'com',
  'e',
  'ou',
  'em',
]);

/** Extrai termos uteis para CAEPI a partir do nome da necessidade. */
function needSearchTerms(needName: string): string[] {
  const cleaned = needName.trim();
  if (!cleaned) return [];
  const terms: string[] = [cleaned];
  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((t) => t.length >= SEARCH_MIN && !STOP_WORDS.has(t.toLowerCase()));
  for (const token of tokens) {
    if (!terms.some((t) => t.toLowerCase() === token.toLowerCase())) {
      terms.push(token);
    }
  }
  const folded = cleaned
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  // Nome operacional vs nome oficial CAEPI
  if (
    folded.includes('viseira') &&
    !terms.some((t) => t.toLowerCase().includes('protetor facial'))
  ) {
    terms.push('protetor facial');
  }
  return terms;
}

/** Termo inicial preferido ao abrir o seletor (sinonimo oficial quando houver). */
function preferredCaepiQuery(needName: string): string {
  const terms = needSearchTerms(needName);
  const synonym = terms.find((t) => /protetor facial/i.test(t));
  if (synonym) return synonym;
  return terms[1] ?? terms[0] ?? needName;
}

const CAEPI_PICKER_LIMIT = 50;

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
      <span className="caepi-suggest-item__ca">CA {item.caNumber}</span>
      <span className={caStatusClassName(item.status)}>
        {formatCaStatusLabel(item.status)}
      </span>
      <span className="caepi-suggest-item__meta">
        {item.equipmentName || 'Equipamento nao informado'}
      </span>
      <span className="caepi-suggest-item__meta">
        {item.manufacturerName || 'Fabricante nao informado'}
      </span>
      {item.reference ? (
        <span className="caepi-suggest-item__meta">Ref. {item.reference}</span>
      ) : null}
      <span className="caepi-suggest-item__meta">
        Validade {formatDate(item.expiresAt)}
      </span>
    </button>
  );
}

type NeedRow = {
  needId: string;
  needName: string;
  jobNames: string[];
  quantity: number;
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
      void searchPortalCaepi(q, CAEPI_PICKER_LIMIT, { validOnly: true })
        .then((res) => {
          setSuggestions(res.items);
          setSearchMessage(
            res.items.length === 0
              ? res.message ?? 'Nenhum CA valido encontrado na base CAEPI.'
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
      let res = await searchPortalCaepi(query, CAEPI_PICKER_LIMIT, {
        validOnly: true,
      });
      // Se o nome operacional nao bate, tenta sinonimos / tokens (ex.: Viseira → Protetor facial).
      if (res.items.length === 0) {
        for (const fallback of needSearchTerms(query)) {
          if (fallback.toLowerCase() === query.toLowerCase()) continue;
          res = await searchPortalCaepi(fallback, CAEPI_PICKER_LIMIT, {
            validOnly: true,
          });
          if (res.items.length > 0) break;
        }
      }
      setNeedRows((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                suggestLoading: false,
                suggestions: res.items,
                suggestMessage:
                  res.items.length === 0
                    ? res.message ??
                      `Nenhum CA valido na base para "${query}". Tente o numero do CA.`
                    : res.message,
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
    const initialQ =
      row.pickerQuery.trim() || preferredCaepiQuery(row.needName);
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
          selected: check.compatible,
          picking: false,
          suggestions: [],
          suggestMessage: check.compatible
            ? null
            : `CA ${cert.caNumber} nao combina: ${check.reason}`,
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
        needName: row.needName,
        equipmentName: row.picked!.equipmentName,
      }));
    if (items.length === 0) {
      setError('Selecione o EPI (CA) de cada necessidade que deseja incluir.');
      return;
    }
    const mismatch = items.find(
      (item) =>
        !assessNeedEquipmentCompatibility(item.needName, item.equipmentName)
          .compatible,
    );
    if (mismatch) {
      setError(
        `CA ${mismatch.caNumber} nao combina com "${mismatch.needName}". Escolha outro CA.`,
      );
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await createPortalStockEntradas(
        items.map(({ epiNeedId, caNumber, quantity }) => ({
          epiNeedId,
          caNumber,
          quantity,
        })),
      );
      setSuccess(`${result.created} entrada(s) registrada(s) no estoque.`);
      setView('dashboard');
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao registrar entradas.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onFreeEntrada(event: FormEvent) {
    event.preventDefault();
    if (!picked) {
      setError('Selecione um EPI da base CAEPI.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await createPortalStockEntradas([
        {
          caNumber: picked.caNumber,
          quantity: freeQty,
        },
      ]);
      setSuccess(
        `Entrada de ${freeQty} un. (CA ${picked.caNumber}) registrada.`,
      );
      setPicked(null);
      setQuery('');
      setSuggestions([]);
      setFreeQty(1);
      setView('dashboard');
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
          <section className="portal-card" aria-labelledby="needs-stock-title">
            <h2 id="needs-stock-title" className="page-title page-title--sm">
              Por necessidade da empresa
            </h2>
            <p className="page-lead">
              Clique em <strong>Escolher EPI na base</strong>. Listamos CAs{' '}
              <strong>validos</strong> (ate 50). Se o produto nao aparecer,
              digite o <strong>numero do CA</strong> da nota/embalagem.
            </p>

            {needRows.length === 0 ? (
              <p className="page-lead">
                Nenhuma necessidade ativa nesta empresa (PGRO/estrutura).
              </p>
            ) : (
              <>
                <div className="table-wrap">
                  <table className="data-table data-table--refined">
                    <thead>
                      <tr>
                        <th scope="col">Incluir</th>
                        <th scope="col">Necessidade</th>
                        <th scope="col">EPI escolhido (base CAEPI)</th>
                        <th scope="col">Qtd</th>
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
                                Escolher EPI na base
                              </button>
                            )}

                            {row.picking ? (
                              <div
                                className="caepi-suggest-wrap"
                                style={{ marginTop: '0.5rem' }}
                              >
                                <label className="field-hint" htmlFor={`need-caepi-${row.needId}`}>
                                  Nome do EPI ou numero do CA (so validos)
                                </label>
                                <input
                                  id={`need-caepi-${row.needId}`}
                                  value={row.pickerQuery}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setNeedRows((prev) =>
                                      prev.map((r, i) =>
                                        i === index
                                          ? { ...r, pickerQuery: value }
                                          : r,
                                      ),
                                    );
                                    const prevTimer =
                                      needSearchTimers.current[row.needId];
                                    if (prevTimer) {
                                      window.clearTimeout(prevTimer);
                                    }
                                    needSearchTimers.current[row.needId] =
                                      window.setTimeout(() => {
                                        void loadNeedSuggestions(index, value);
                                      }, SEARCH_DEBOUNCE_MS);
                                  }}
                                  placeholder="Ex.: protetor facial ou 11442"
                                  autoComplete="off"
                                />
                                {row.suggestLoading ? (
                                  <p className="field-hint">Buscando na CAEPI...</p>
                                ) : null}
                                {row.suggestMessage ? (
                                  <p className="field-hint">
                                    {row.suggestMessage}
                                  </p>
                                ) : null}
                                {row.suggestions.length > 0 ? (
                                  <ul
                                    className="caepi-suggest-list caepi-suggest-list--slot"
                                    role="listbox"
                                  >
                                    {row.suggestions.map((item) => (
                                      <li key={item.caNumber}>
                                        <CaepiSuggestionButton
                                          item={item}
                                          onSelect={() =>
                                            pickForNeed(index, item)
                                          }
                                        />
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            ) : null}
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flow-sticky-bar">
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
                      : `Incluir no estoque (${selectedNeedCount})`}
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="portal-card" aria-labelledby="entrada-livre-title">
            <h2 id="entrada-livre-title" className="page-title page-title--sm">
              Entrada avulsa (base CAEPI)
            </h2>
            <p className="page-lead">
              Digite o nome (ex.: protetor facial) ou o <strong>numero do CA</strong>{' '}
              (ex.: 11442). Mostramos ate 50 CAs validos; se nao achar na lista,
              busque pelo numero.
            </p>
            <form className="form-panel" onSubmit={onFreeEntrada}>
              <div className="field">
                <label htmlFor="portal-caepi-search">
                  Nome / equipamento ou numero do CA
                </label>
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
                  placeholder="Ex.: protetor facial ou 11442"
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
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving || !picked}
              >
                {saving ? 'Salvando...' : 'Incluir no estoque'}
              </button>
            </form>
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
