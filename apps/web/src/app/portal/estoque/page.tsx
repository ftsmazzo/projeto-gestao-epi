'use client';

import type {
  PortalEpiSearchItem,
  PortalEstoqueResponse,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import {
  createPortalStockEntradas,
  fetchPortalEstoque,
  lookupPortalEpiByCa,
  searchPortalEpis,
} from '../../../lib/client-auth';

const SEARCH_MIN = 3;
const SEARCH_DEBOUNCE_MS = 350;

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

type NeedRow = {
  needId: string;
  needName: string;
  epiItemId: string | null;
  epiName: string | null;
  caNumber: string;
  caExpiresAt: string | null;
  usefulLifeLabel: string | null;
  quantity: number;
  selected: boolean;
  jobNames: string[];
};

function buildNeedRows(data: PortalEstoqueResponse): NeedRow[] {
  const rows: NeedRow[] = [];
  for (const need of data.needs) {
    if (need.items.length > 0) {
      for (const item of need.items) {
        rows.push({
          needId: need.needId,
          needName: need.needName,
          epiItemId: item.id,
          epiName: item.name,
          caNumber: item.caNumber ?? '',
          caExpiresAt: item.caExpiresAt,
          usefulLifeLabel: item.usefulLifeLabel,
          quantity: need.suggestedQuantity || 1,
          selected: true,
          jobNames: need.jobNames,
        });
      }
    } else {
      rows.push({
        needId: need.needId,
        needName: need.needName,
        epiItemId: null,
        epiName: null,
        caNumber: '',
        caExpiresAt: null,
        usefulLifeLabel: null,
        quantity: need.suggestedQuantity || 1,
        selected: true,
        jobNames: need.jobNames,
      });
    }
  }
  return rows;
}

function PortalEstoqueContent() {
  const [data, setData] = useState<PortalEstoqueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PortalEpiSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const [selected, setSelected] = useState<PortalEpiSearchItem | null>(null);
  const [freeQty, setFreeQty] = useState(1);
  const [caQuery, setCaQuery] = useState('');
  const [lookingCa, setLookingCa] = useState(false);

  const [needRows, setNeedRows] = useState<NeedRow[]>([]);

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

  useEffect(() => {
    const q = query.trim();
    if (selected) return;
    if (q.length < SEARCH_MIN) {
      setSuggestions([]);
      setSearching(false);
      setSearchHint(
        q.length > 0 ? `Digite mais ${SEARCH_MIN - q.length} letra(s)...` : null,
      );
      return;
    }
    setSearching(true);
    setSearchHint(null);
    const handle = window.setTimeout(() => {
      void searchPortalEpis(q)
        .then((items) => {
          setSuggestions(items);
          setSearchHint(
            items.length === 0
              ? 'Nenhuma necessidade/EPI com esse nome. Confira a estrutura/PGRO desta empresa.'
              : null,
          );
        })
        .catch((err: unknown) => {
          setSuggestions([]);
          setSearchHint(
            err instanceof Error ? err.message : 'Falha na busca.',
          );
        })
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query, selected]);

  const selectedNeedCount = useMemo(
    () =>
      needRows.filter((row) => {
        if (!row.selected || row.quantity < 1) return false;
        if (row.epiItemId) return true;
        return row.caNumber.trim().length >= 3;
      }).length,
    [needRows],
  );

  async function onLookupCa() {
    const ca = caQuery.trim();
    if (ca.length < 3) {
      setError('Informe um CA com ao menos 3 digitos.');
      return;
    }
    setLookingCa(true);
    setError(null);
    try {
      const result = await lookupPortalEpiByCa(ca);
      if (result.found && result.item) {
        setSelected(result.item);
        setQuery(result.item.name);
        setCaQuery(result.item.caNumber ?? ca);
        setSuggestions([]);
        setSearchHint(result.message);
      } else {
        // CA existe na CAEPI mesmo sem item — permite entrada com CA
        setSelected({
          id: `ca:${ca}`,
          name: `EPI CA ${ca}`,
          caNumber: ca,
          caExpiresAt: null,
          usefulLifeValue: null,
          usefulLifeUnit: null,
          usefulLifeLabel: null,
          unitOfMeasure: 'UNIDADE',
          category: null,
          requiresCa: false,
        });
        setSearchHint(
          result.message ??
            'CA sera usado para criar/vincular o EPI no catalogo na entrada.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao buscar CA.');
    } finally {
      setLookingCa(false);
    }
  }

  async function onFreeEntrada(event: FormEvent) {
    event.preventDefault();
    if (!selected) {
      setError('Selecione uma necessidade/EPI ou informe o CA.');
      return;
    }
    const ca = (caQuery || selected.caNumber || '').trim();
    const epiNeedId = selected.epiNeedId;
    const epiItemId = selected.requiresCa
      ? undefined
      : selected.id.startsWith('need:') || selected.id.startsWith('ca:')
        ? undefined
        : selected.id;

    if (!epiItemId && !ca) {
      setError('Informe o CA para esta necessidade.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await createPortalStockEntradas([
        {
          epiItemId,
          epiNeedId,
          caNumber: ca || undefined,
          quantity: freeQty,
        },
      ]);
      setSuccess(`Entrada de ${freeQty} un. registrada.`);
      setSelected(null);
      setQuery('');
      setCaQuery('');
      setSuggestions([]);
      setFreeQty(1);
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao registrar entrada.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onBatchEntrada() {
    const items = needRows
      .filter((row) => row.selected && row.quantity > 0)
      .map((row) => ({
        epiItemId: row.epiItemId ?? undefined,
        epiNeedId: row.needId,
        caNumber: row.caNumber.trim() || undefined,
        quantity: row.quantity,
      }))
      .filter((row) => row.epiItemId || (row.caNumber && row.caNumber.length >= 3));

    if (items.length === 0) {
      setError(
        'Marque as necessidades e informe o CA (ou use o EPI ja vinculado).',
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await createPortalStockEntradas(items);
      setSuccess(
        `${result.created} entrada(s) no estoque. Itens novos criados/vinculados quando necessario.`,
      );
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao registrar entradas.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="portal-home">
      <header className="portal-home-header">
        <div>
          <p className="page-kicker">Dia a dia</p>
          <h1 className="page-title page-title--sm">Estoque</h1>
          <p className="page-lead">
            A Consultoria gera as <strong>necessidades</strong> (PGRO/estrutura).
            Aqui voce informa o <strong>CA</strong> e a quantidade — o sistema
            cruza com o catalogo e entra no estoque desta empresa.
          </p>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="notice notice--info" role="status">
          {success}
        </p>
      ) : null}
      {loading ? <p className="page-lead">Carregando estoque...</p> : null}

      {data ? (
        <>
          <div className="notice notice--info" role="status">
            <p>
              {data.note} Local: <strong>{data.location.name}</strong>.
            </p>
          </div>

          <section className="quota-summary" aria-label="Resumo">
            <div className="quota-summary-item">
              <span className="quota-summary-label">Necessidades</span>
              <strong className="quota-summary-value">{data.summary.needs}</strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Ja com EPI/CA</span>
              <strong className="quota-summary-value">
                {data.summary.withLinkedEpi}
              </strong>
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

          <section className="portal-card" aria-labelledby="needs-stock-title">
            <h2 id="needs-stock-title" className="page-title page-title--sm">
              Necessidades desta empresa
            </h2>
            <p className="page-lead">
              Lista vinda da estrutura/PGRO. Se o CA ja estiver vinculado,
              confirme a quantidade. Se faltar CA, preencha e inclua.
            </p>

            {needRows.length === 0 ? (
              <p className="page-lead">
                Nenhuma necessidade ativa. A Consultoria precisa importar o PGRO
                ou cadastrar necessidades nas funcoes.
              </p>
            ) : (
              <>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Incluir</th>
                        <th scope="col">Necessidade</th>
                        <th scope="col">EPI / CA</th>
                        <th scope="col">Validade</th>
                        <th scope="col">Vida util</th>
                        <th scope="col">Qtd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {needRows.map((row, index) => (
                        <tr key={`${row.needId}:${row.epiItemId ?? index}`}>
                          <td>
                            <input
                              type="checkbox"
                              checked={row.selected}
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
                            {row.epiName ? (
                              <span>
                                {row.epiName}
                                <span className="table-sub mono">
                                  CA {row.caNumber || '—'}
                                </span>
                              </span>
                            ) : (
                              <input
                                className="portal-qty-input mono"
                                style={{ width: '8rem' }}
                                placeholder="Nº CA"
                                value={row.caNumber}
                                disabled={!row.selected}
                                onChange={(e) =>
                                  setNeedRows((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? { ...r, caNumber: e.target.value }
                                        : r,
                                    ),
                                  )
                                }
                                aria-label={`CA ${row.needName}`}
                              />
                            )}
                          </td>
                          <td>{formatDate(row.caExpiresAt)}</td>
                          <td>{row.usefulLifeLabel ?? '—'}</td>
                          <td>
                            <input
                              type="number"
                              min={1}
                              className="portal-qty-input"
                              value={row.quantity}
                              disabled={!row.selected}
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
                <div className="btn-row" style={{ marginTop: '0.75rem' }}>
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

          <section className="portal-card" aria-labelledby="saldos-title">
            <h2 id="saldos-title" className="page-title page-title--sm">
              Saldos atuais
            </h2>
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
          </section>

          <section className="portal-card" aria-labelledby="entrada-livre-title">
            <h2 id="entrada-livre-title" className="page-title page-title--sm">
              Entrada avulsa
            </h2>
            <p className="page-lead">
              Busque pelo nome da necessidade (ex.: luva) ou pelo CA.
            </p>
            <form className="form-panel" onSubmit={onFreeEntrada}>
              <div className="field">
                <label htmlFor="portal-epi-search">Nome</label>
                <input
                  id="portal-epi-search"
                  value={selected ? selected.name : query}
                  onChange={(e) => {
                    setSelected(null);
                    setQuery(e.target.value);
                  }}
                  placeholder="Ex.: luva, botina, oculos..."
                  autoComplete="off"
                />
                {searching ? <p className="field-hint">Buscando...</p> : null}
                {searchHint ? (
                  <p className="field-hint">{searchHint}</p>
                ) : null}
                {!selected && suggestions.length > 0 ? (
                  <ul className="portal-suggest-list" role="listbox">
                    {suggestions.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="portal-suggest-item"
                          onClick={() => {
                            setSelected(item);
                            setQuery(item.name);
                            setCaQuery(item.caNumber ?? '');
                            setSuggestions([]);
                            setSearchHint(
                              item.requiresCa
                                ? 'Informe o CA desta necessidade para entrar no estoque.'
                                : null,
                            );
                          }}
                        >
                          <strong>{item.name}</strong>
                          <span className="table-sub">
                            {item.requiresCa
                              ? 'Necessidade — informe o CA'
                              : `CA ${item.caNumber ?? '—'} · Val. ${formatDate(item.caExpiresAt)}`}
                            {item.needName ? ` · ${item.needName}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="portal-epi-ca">Numero do CA</label>
                  <input
                    id="portal-epi-ca"
                    className="mono"
                    value={caQuery}
                    onChange={(e) => setCaQuery(e.target.value)}
                    placeholder="Ex.: 12345"
                    autoComplete="off"
                  />
                </div>
                <div className="field" style={{ alignSelf: 'end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={lookingCa || caQuery.trim().length < 3}
                    onClick={() => void onLookupCa()}
                  >
                    {lookingCa ? 'Buscando...' : 'Buscar CA'}
                  </button>
                </div>
              </div>

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
                disabled={saving || !selected}
              >
                {saving ? 'Salvando...' : 'Incluir no estoque'}
              </button>
            </form>
          </section>

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
