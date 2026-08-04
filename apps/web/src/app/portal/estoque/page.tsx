'use client';

import type {
  CaCertificateSearchItem,
  PortalEstoqueResponse,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import {
  caStatusClassName,
  formatCaStatusLabel,
} from '../../../lib/caepi-assist';
import {
  createPortalStockEntradas,
  fetchPortalEstoque,
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

/** Extrai termo util para CAEPI a partir do nome da necessidade (ex.: "Luva de Vaqueta" -> "Luva"). */
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
  return terms;
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
      pickerQuery: needSearchTerms(need.needName)[1] ?? need.needName,
      suggestions: [],
      suggestLoading: false,
      suggestMessage: null,
    };
  });
}

function PortalEstoqueContent() {
  const [data, setData] = useState<PortalEstoqueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'entrada' | 'saldos'>('entrada');

  const [needRows, setNeedRows] = useState<NeedRow[]>([]);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CaCertificateSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [picked, setPicked] = useState<CaCertificateSearchItem | null>(null);
  const [freeQty, setFreeQty] = useState(1);
  const needSearchTimers = useRef<Record<string, number>>({});

  async function reload() {
    const res = await fetchPortalEstoque();
    setData(res);
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
      void searchPortalCaepi(q, 12)
        .then((res) => {
          setSuggestions(res.items);
          setSearchMessage(
            res.items.length === 0
              ? res.message ?? 'Nenhum CA encontrado na base CAEPI.'
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
      let res = await searchPortalCaepi(query, 15);
      // Se o nome completo da necessidade nao bate na CAEPI, tenta o primeiro termo util.
      if (res.items.length === 0) {
        const fallback = needSearchTerms(query).find(
          (t) => t.toLowerCase() !== query.toLowerCase(),
        );
        if (fallback) {
          res = await searchPortalCaepi(fallback, 15);
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
                      `Nenhum EPI na base CAEPI para "${query}".`
                    : null,
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
      row.pickerQuery.trim() ||
      needSearchTerms(row.needName)[1] ||
      row.needName;
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
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              picked: cert,
              selected: true,
              picking: false,
              suggestions: [],
              suggestMessage: null,
            }
          : r,
      ),
    );
  }

  async function onBatchEntrada() {
    const items = needRows
      .filter((row) => row.selected && row.picked && row.quantity > 0)
      .map((row) => ({
        epiNeedId: row.needId,
        caNumber: row.picked!.caNumber,
        quantity: row.quantity,
      }));
    if (items.length === 0) {
      setError('Selecione o EPI (CA) de cada necessidade que deseja incluir.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await createPortalStockEntradas(items);
      setSuccess(`${result.created} entrada(s) registrada(s) no estoque.`);
      setView('saldos');
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
      setView('saldos');
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao registrar entrada.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="portal-home">
      <header className="portal-home-header portal-home-header--decision">
        <div>
          <p className="page-kicker">Dia a dia</p>
          <h1 className="page-title page-title--sm">Estoque</h1>
          <p className="page-lead">
            Busque o EPI na <strong>base CAEPI</strong>, vincule a necessidade e
            registre a entrada. Depois confira os saldos.
          </p>
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
          <section className="quota-summary" aria-label="Resumo">
            <div className="quota-summary-item">
              <span className="quota-summary-label">Necessidades</span>
              <strong className="quota-summary-value">{data.summary.needs}</strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Linhas em saldo</span>
              <strong className="quota-summary-value">
                {data.summary.balanceLines}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Unidades</span>
              <strong className="quota-summary-value">
                {data.summary.totalUnits}
              </strong>
            </div>
          </section>

          <div
            className="portal-section-tabs"
            role="tablist"
            aria-label="Visoes do estoque"
          >
            <button
              type="button"
              role="tab"
              className={`portal-section-tab ${view === 'entrada' ? 'is-active' : ''}`}
              aria-selected={view === 'entrada'}
              onClick={() => setView('entrada')}
            >
              Registrar entrada
            </button>
            <button
              type="button"
              role="tab"
              className={`portal-section-tab ${view === 'saldos' ? 'is-active' : ''}`}
              aria-selected={view === 'saldos'}
              onClick={() => setView('saldos')}
            >
              Ver saldos
            </button>
          </div>

          {view === 'entrada' ? (
            <>
          <section className="portal-card" aria-labelledby="needs-stock-title">
            <h2 id="needs-stock-title" className="page-title page-title--sm">
              Por necessidade da empresa
            </h2>
            <p className="page-lead">
              Clique em <strong>Escolher EPI na base</strong> para ver os CAs da
              CAEPI com aquele nome. Selecione o que comprou e a quantidade.
            </p>

            {needRows.length === 0 ? (
              <p className="page-lead">
                Nenhuma necessidade ativa nesta empresa (PGRO/estrutura).
              </p>
            ) : (
              <>
                <div className="table-wrap">
                  <table className="data-table">
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
                                  Busca na base CAEPI (mesmo catalogo da Consultoria)
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
                                  placeholder="Ex.: luva"
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
                    onClick={() => setView('saldos')}
                  >
                    Ver saldos
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
              Digite o nome (ex.: luva). Aparecem os mesmos CAs do catalogo
              mestre. Escolha o produto e a quantidade.
            </p>
            <form className="form-panel" onSubmit={onFreeEntrada}>
              <div className="field">
                <label htmlFor="portal-caepi-search">Nome / equipamento</label>
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
                  placeholder="Ex.: luva"
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
          ) : (
          <section className="portal-card" aria-labelledby="saldos-title">
            <h2 id="saldos-title" className="page-title page-title--sm">
              Saldos atuais
            </h2>
            <p className="page-lead">
              Quantidades disponiveis para entrega. Se faltar item, volte em
              Registrar entrada.
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">EPI</th>
                    <th scope="col">CA</th>
                    <th scope="col">Validade CA</th>
                    <th scope="col">Vida util</th>
                    <th scope="col">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {data.balances.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Nenhum saldo ainda neste local.</td>
                    </tr>
                  ) : (
                    data.balances.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.epiName}</strong>
                        </td>
                        <td className="mono">{row.caNumber ?? '—'}</td>
                        <td>{formatDate(row.caExpiresAt)}</td>
                        <td>{row.usefulLifeLabel ?? '—'}</td>
                        <td className="mono">{row.quantity}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="btn-row" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setView('entrada')}
              >
                Registrar entrada
              </button>
              <Link className="btn btn-primary" href="/portal/entregas">
                Ir para entregas
              </Link>
            </div>
          </section>
          )}

          <div className="btn-row">
            <Link className="btn btn-secondary" href="/portal">
              Voltar ao painel
            </Link>
          </div>
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
