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

type NeedPickRow = {
  key: string;
  needId: string;
  needName: string;
  epiItemId: string;
  epiName: string;
  caNumber: string | null;
  caExpiresAt: string | null;
  usefulLifeLabel: string | null;
  quantity: number;
  selected: boolean;
};

function PortalEstoqueContent() {
  const [data, setData] = useState<PortalEstoqueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PortalEpiSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedEpi, setSelectedEpi] = useState<PortalEpiSearchItem | null>(
    null,
  );
  const [freeQty, setFreeQty] = useState(1);

  const [needRows, setNeedRows] = useState<NeedPickRow[]>([]);
  const [listGenerated, setListGenerated] = useState(false);

  async function reload() {
    const res = await fetchPortalEstoque();
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
    if (q.length < SEARCH_MIN) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = window.setTimeout(() => {
      void searchPortalEpis(q)
        .then((items) => setSuggestions(items))
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  const selectedNeedCount = useMemo(
    () => needRows.filter((row) => row.selected && row.quantity > 0).length,
    [needRows],
  );

  function generateNeedList() {
    if (!data) return;
    const rows: NeedPickRow[] = [];
    for (const need of data.needs) {
      if (need.items.length === 0) continue;
      for (const item of need.items) {
        rows.push({
          key: `${need.needId}:${item.id}`,
          needId: need.needId,
          needName: need.needName,
          epiItemId: item.id,
          epiName: item.name,
          caNumber: item.caNumber,
          caExpiresAt: item.caExpiresAt,
          usefulLifeLabel: item.usefulLifeLabel,
          quantity: need.suggestedQuantity || 1,
          selected: true,
        });
      }
    }
    setNeedRows(rows);
    setListGenerated(true);
    setSuccess(null);
    setError(null);
  }

  async function onFreeEntrada(event: FormEvent) {
    event.preventDefault();
    if (!selectedEpi) {
      setError('Selecione um EPI da busca.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await createPortalStockEntradas([
        { epiItemId: selectedEpi.id, quantity: freeQty },
      ]);
      setSuccess(
        `Entrada de ${freeQty} un. de ${selectedEpi.name} registrada.`,
      );
      setSelectedEpi(null);
      setQuery('');
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
      .map((row) => ({ epiItemId: row.epiItemId, quantity: row.quantity }));
    if (items.length === 0) {
      setError('Selecione ao menos um EPI com quantidade.');
      return;
    }
    // Agrupa mesmo epiItemId somando qty
    const merged = new Map<string, number>();
    for (const item of items) {
      merged.set(
        item.epiItemId,
        (merged.get(item.epiItemId) ?? 0) + item.quantity,
      );
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await createPortalStockEntradas(
        Array.from(merged.entries()).map(([epiItemId, quantity]) => ({
          epiItemId,
          quantity,
        })),
      );
      setSuccess(`${result.created} entrada(s) registrada(s) no estoque.`);
      setListGenerated(false);
      setNeedRows([]);
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
            Inclua EPIs do catalogo no estoque desta empresa. A validade do CA e
            a vida util aparecem para preparar o controle na entrega.
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

          <section className="quota-summary" aria-label="Resumo de estoque">
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
            <div className="quota-summary-item">
              <span className="quota-summary-label">Necessidades</span>
              <strong className="quota-summary-value">{data.summary.needs}</strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Com EPI vinculado</span>
              <strong className="quota-summary-value">
                {data.summary.withLinkedEpi}
              </strong>
            </div>
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
                      <td colSpan={5}>
                        Nenhum saldo ainda. Use a entrada livre ou gere a lista
                        pelas necessidades.
                      </td>
                    </tr>
                  ) : (
                    data.balances.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.epiName}</strong>
                          <span className="table-sub">{row.locationName}</span>
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
              Entrada livre
            </h2>
            <p className="page-lead">
              Digite ao menos {SEARCH_MIN} letras do nome ou o CA. So EPIs ja
              cadastrados no catalogo da Consultoria.
            </p>
            <form className="form-panel" onSubmit={onFreeEntrada}>
              <div className="field">
                <label htmlFor="portal-epi-search">Buscar EPI</label>
                <input
                  id="portal-epi-search"
                  value={selectedEpi ? selectedEpi.name : query}
                  onChange={(e) => {
                    setSelectedEpi(null);
                    setQuery(e.target.value);
                  }}
                  placeholder="Nome ou CA..."
                  autoComplete="off"
                />
                {searching ? (
                  <p className="field-hint">Buscando...</p>
                ) : null}
                {!selectedEpi && suggestions.length > 0 ? (
                  <ul className="portal-suggest-list" role="listbox">
                    {suggestions.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="portal-suggest-item"
                          onClick={() => {
                            setSelectedEpi(item);
                            setQuery(item.name);
                            setSuggestions([]);
                          }}
                        >
                          <strong>{item.name}</strong>
                          <span className="table-sub">
                            CA {item.caNumber ?? '—'} · Val.{' '}
                            {formatDate(item.caExpiresAt)} · Vida util{' '}
                            {item.usefulLifeLabel ?? '—'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {selectedEpi ? (
                  <p className="field-hint">
                    CA {selectedEpi.caNumber ?? '—'} · Validade{' '}
                    {formatDate(selectedEpi.caExpiresAt)} · Vida util{' '}
                    {selectedEpi.usefulLifeLabel ?? '—'}
                  </p>
                ) : null}
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
                disabled={saving || !selectedEpi}
              >
                {saving ? 'Salvando...' : 'Incluir no estoque'}
              </button>
            </form>
          </section>

          <section className="portal-card" aria-labelledby="por-needs-title">
            <h2 id="por-needs-title" className="page-title page-title--sm">
              Por necessidades
            </h2>
            <p className="page-lead">
              Cruza as necessidades das funcoes com os EPIs vinculados (por CA)
              no catalogo. Ajuste a quantidade e inclua.
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={generateNeedList}
                disabled={data.needs.every((n) => !n.hasLinkedEpi)}
              >
                Gerar lista de EPIs necessarias
              </button>
            </div>
            {data.summary.withoutLinkedEpi > 0 ? (
              <p className="field-hint" style={{ marginTop: '0.75rem' }}>
                {data.summary.withoutLinkedEpi} necessidade(s) sem EPI
                vinculado — a Consultoria precisa vincular no catalogo.
              </p>
            ) : null}

            {listGenerated ? (
              <>
                <div className="table-wrap" style={{ marginTop: '1rem' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Incluir</th>
                        <th scope="col">Necessidade</th>
                        <th scope="col">EPI</th>
                        <th scope="col">CA</th>
                        <th scope="col">Validade</th>
                        <th scope="col">Vida util</th>
                        <th scope="col">Qtd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {needRows.length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            Nenhuma necessidade com EPI vinculado para gerar.
                          </td>
                        </tr>
                      ) : (
                        needRows.map((row) => (
                          <tr key={row.key}>
                            <td>
                              <input
                                type="checkbox"
                                checked={row.selected}
                                onChange={(e) =>
                                  setNeedRows((prev) =>
                                    prev.map((r) =>
                                      r.key === row.key
                                        ? {
                                            ...r,
                                            selected: e.target.checked,
                                          }
                                        : r,
                                    ),
                                  )
                                }
                                aria-label={`Incluir ${row.epiName}`}
                              />
                            </td>
                            <td>{row.needName}</td>
                            <td>
                              <strong>{row.epiName}</strong>
                            </td>
                            <td className="mono">{row.caNumber ?? '—'}</td>
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
                                    prev.map((r) =>
                                      r.key === row.key
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
                                aria-label={`Quantidade ${row.epiName}`}
                              />
                            </td>
                          </tr>
                        ))
                      )}
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
                      : `Incluir selecionados (${selectedNeedCount})`}
                  </button>
                </div>
              </>
            ) : null}
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
