'use client';

import type {
  AuthUser,
  CaCertificate,
  CaCertificateSearchItem,
  CaepiStatusResponse,
} from '@gestao-epi/shared';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import {
  caStatusClassName,
  formatCaStatusLabel,
} from '../../lib/caepi-assist';
import { lookupCaCertificate, searchCaCertificates } from '../../lib/caepi';
import { getCaepiStatus, startCaepiSync } from '../../lib/caepi-admin';

const SEARCH_MIN = 3;
const SEARCH_LIMIT = 40;

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

function looksLikeCaNumber(raw: string) {
  const t = raw.trim().replace(/\s+/g, '');
  return /^\d{4,8}$/.test(t);
}

function isAdminRole(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

export default function CatalogoEpisPage() {
  return (
    <RequireAuth>
      {(user) => <CatalogoEpisContent user={user} />}
    </RequireAuth>
  );
}

function CatalogoEpisContent({ user }: { user: AuthUser }) {
  const canManageBase = isAdminRole(user.membershipRole);
  const [query, setQuery] = useState('');
  const [validOnly, setValidOnly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [items, setItems] = useState<CaCertificateSearchItem[]>([]);
  const [selected, setSelected] = useState<CaCertificate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [status, setStatus] = useState<CaepiStatusResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!canManageBase) return;
    try {
      const next = await getCaepiStatus();
      setStatus(next);
    } catch {
      setStatus(null);
    }
  }, [canManageBase]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const kpis = useMemo(() => {
    if (!status) return [];
    return [
      {
        id: 'total',
        label: 'CAs na base',
        value: status.certificatesTotal.toLocaleString('pt-BR'),
        hint: 'Fonte oficial do Ministerio do Trabalho',
      },
      {
        id: 'updated',
        label: 'Ultima atualizacao',
        value: formatDate(
          status.lastImport?.finishedAt ?? status.lastImport?.startedAt,
        ),
        hint:
          status.lastImport?.status === 'SUCCESS'
            ? 'Base atualizada'
            : status.lastImport
              ? `Ultima execucao: ${status.lastImport.status}`
              : 'Ainda sem sync',
        tone:
          status.lastImport?.status === 'FAILED'
            ? ('warn' as const)
            : ('ok' as const),
      },
      {
        id: 'norms',
        label: 'Normas / laudos',
        value: status.normsTotal.toLocaleString('pt-BR'),
      },
    ];
  }, [status]);

  async function openDetail(caNumber: string) {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await lookupCaCertificate(caNumber);
      if (res.found && res.certificate) {
        setSelected(res.certificate);
      } else {
        setSelected(null);
        setHint(res.message ?? `CA ${caNumber} nao encontrado.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir o CA.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function onSearch(event?: FormEvent) {
    event?.preventDefault();
    const q = query.trim();
    if (q.length < SEARCH_MIN && !looksLikeCaNumber(q)) {
      setError('Digite o numero do CA ou ao menos 3 letras do equipamento.');
      return;
    }
    setLoading(true);
    setError(null);
    setHint(null);
    setItems([]);
    try {
      if (looksLikeCaNumber(q)) {
        const res = await lookupCaCertificate(q);
        if (res.found && res.certificate) {
          setSelected(res.certificate);
          setItems([
            {
              caNumber: res.certificate.caNumber,
              status: res.certificate.status,
              expiresAt: res.certificate.expiresAt,
              equipmentName: res.certificate.equipmentName,
              manufacturerName: res.certificate.manufacturerName,
              reference: res.certificate.reference,
              color: res.certificate.color,
              sourceImportedAt: res.certificate.sourceImportedAt,
            },
          ]);
          setHint(null);
        } else {
          setSelected(null);
          setHint(res.message ?? `CA ${q} nao encontrado na base local.`);
        }
        return;
      }

      const res = await searchCaCertificates(q, SEARCH_LIMIT, { validOnly });
      setItems(res.items);
      setHint(
        res.items.length === 0
          ? res.message ?? 'Nenhum EPI encontrado para esse termo.'
          : `${res.items.length} resultado(s). Clique para ver o detalhe.`,
      );
      if (res.items.length === 1) {
        await openDetail(res.items[0].caNumber);
      } else {
        setSelected(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na busca.');
    } finally {
      setLoading(false);
    }
  }

  async function onSync() {
    if (!canManageBase) return;
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      await startCaepiSync();
      setSyncMessage('Atualizacao da base iniciada. Recarregue em instantes.');
      window.setTimeout(() => void loadStatus(), 4000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao atualizar a base.',
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="module-page catalog-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Consultoria</p>
          <h1 className="page-title">Catalogo de EPIs</h1>
          <p className="page-lead">
            Consulta da <strong>base oficial CAEPI</strong>. Nao e cadastro
            interno: o gestor busca o equipamento pelo nome ou pelo numero do
            CA — validade, fabricante e restricoes vêm da fonte do Ministerio
            do Trabalho.
          </p>
        </div>
      </header>

      {status && kpis.length > 0 ? (
        <section className="dash-kpi-grid" aria-label="Situacao da base">
          {kpis.map((item) => (
            <article
              key={item.id}
              className={`dash-kpi${item.tone === 'warn' ? ' dash-kpi--warn' : item.tone === 'ok' ? ' dash-kpi--ok' : ''}`}
            >
              <p className="dash-kpi__label">{item.label}</p>
              <p className="dash-kpi__value">{item.value}</p>
              {'hint' in item && item.hint ? (
                <p className="dash-kpi__hint">{item.hint}</p>
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <p className="field-hint">
          Busque um CA (ex.: 11442) ou o nome do equipamento (ex.: protetor
          facial, luva nitrilica).
        </p>
      )}

      <section
        className="dash-panel catalog-search"
        aria-labelledby="catalog-search-title"
      >
        <h2 id="catalog-search-title" className="dash-panel__title">
          Buscar na base
        </h2>
        <form className="catalog-search__form" onSubmit={onSearch}>
          <div className="field catalog-search__field">
            <label htmlFor="catalog-q">Nome do EPI ou numero do CA</label>
            <input
              id="catalog-q"
              value={query}
              autoComplete="off"
              placeholder="Ex.: protetor facial, viseira, luva ou 11442"
              onChange={(e) => {
                setQuery(e.target.value);
                setError(null);
              }}
            />
          </div>
          <label className="catalog-search__check">
            <input
              type="checkbox"
              checked={validOnly}
              onChange={(e) => setValidOnly(e.target.checked)}
            />
            So CAs validos
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || query.trim().length < 2}
          >
            {loading ? 'Buscando...' : 'Consultar'}
          </button>
        </form>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {hint ? <p className="field-hint">{hint}</p> : null}
      </section>

      <div className="catalog-split">
        <section
          className="dash-panel"
          aria-labelledby="catalog-results-title"
        >
          <h2 id="catalog-results-title" className="dash-panel__title">
            Resultados
          </h2>
          {items.length === 0 ? (
            <p className="empty-state">
              Nenhum resultado ainda. Tente “protetor facial” ou um CA de 5
              digitos.
            </p>
          ) : (
            <ul className="catalog-result-list">
              {items.map((item) => {
                const active = selected?.caNumber === item.caNumber;
                return (
                  <li key={item.caNumber}>
                    <button
                      type="button"
                      className={`catalog-result${active ? ' catalog-result--on' : ''}`}
                      onClick={() => void openDetail(item.caNumber)}
                    >
                      <span className="catalog-result__ca">
                        CA {item.caNumber}
                      </span>
                      <span className={caStatusClassName(item.status)}>
                        {formatCaStatusLabel(item.status)}
                      </span>
                      <span className="catalog-result__name">
                        {item.equipmentName || 'Equipamento nao informado'}
                      </span>
                      <span className="catalog-result__meta">
                        {item.manufacturerName || 'Fabricante nao informado'}
                        {item.reference ? ` · Ref. ${item.reference}` : ''}
                        {` · Val. ${formatDate(item.expiresAt)}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="dash-panel" aria-labelledby="catalog-detail-title">
          <h2 id="catalog-detail-title" className="dash-panel__title">
            Ficha do CA
          </h2>
          {detailLoading ? (
            <p className="field-hint">Carregando ficha...</p>
          ) : selected ? (
            <div className="catalog-fiche">
              <div className="catalog-fiche__head">
                <p className="catalog-fiche__ca">CA {selected.caNumber}</p>
                <span className={caStatusClassName(selected.status)}>
                  {formatCaStatusLabel(selected.status)}
                </span>
              </div>
              <h3 className="catalog-fiche__title">
                {selected.equipmentName || 'Equipamento nao informado'}
              </h3>
              <dl className="catalog-fiche__grid">
                <div>
                  <dt>Validade</dt>
                  <dd>{formatDate(selected.expiresAt)}</dd>
                </div>
                <div>
                  <dt>Fabricante</dt>
                  <dd>{selected.manufacturerName || '—'}</dd>
                </div>
                <div>
                  <dt>CNPJ fabricante</dt>
                  <dd className="mono">{selected.manufacturerCnpj || '—'}</dd>
                </div>
                <div>
                  <dt>Marca</dt>
                  <dd>{selected.brand || '—'}</dd>
                </div>
                <div>
                  <dt>Referencia</dt>
                  <dd>{selected.reference || '—'}</dd>
                </div>
                <div>
                  <dt>Cor</dt>
                  <dd>{selected.color || '—'}</dd>
                </div>
                <div>
                  <dt>Natureza</dt>
                  <dd>{selected.nature || '—'}</dd>
                </div>
                <div>
                  <dt>Processo</dt>
                  <dd>{selected.processNumber || '—'}</dd>
                </div>
                <div className="catalog-fiche__span">
                  <dt>Aprovado para</dt>
                  <dd>{selected.approvedFor || '—'}</dd>
                </div>
                <div className="catalog-fiche__span">
                  <dt>Restricao</dt>
                  <dd>{selected.restriction || '—'}</dd>
                </div>
                <div className="catalog-fiche__span">
                  <dt>Descricao</dt>
                  <dd>{selected.equipmentDescription || '—'}</dd>
                </div>
                {selected.analysisNotes ? (
                  <div className="catalog-fiche__span">
                    <dt>Notas tecnicas</dt>
                    <dd>{selected.analysisNotes}</dd>
                  </div>
                ) : null}
              </dl>
              {selected.norms.length > 0 ? (
                <div className="catalog-fiche__norms">
                  <h4>Normas / laudos</h4>
                  <ul>
                    {selected.norms.slice(0, 8).map((norm) => (
                      <li key={norm.id}>
                        {norm.standard || 'Norma nao informada'}
                        {norm.laboratoryName
                          ? ` · ${norm.laboratoryName}`
                          : ''}
                        {norm.reportNumber ? ` · Rel. ${norm.reportNumber}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="empty-state">
              Selecione um resultado ao lado para ver validade, fabricante e
              restricoes oficiais.
            </p>
          )}
        </section>
      </div>

      {canManageBase ? (
        <section
          className="dash-panel catalog-maintain"
          aria-labelledby="catalog-maintain-title"
        >
          <h2 id="catalog-maintain-title" className="dash-panel__title">
            Manutencao da base
          </h2>
          <p className="page-lead">
            A consulta usa a copia local da CAEPI. Atualize quando o Ministerio
            publicar nova exportacao.
          </p>
          {status?.lastImport ? (
            <p className="field-hint">
              Ultima execucao: {formatDateTime(status.lastImport.finishedAt)} ·{' '}
              {status.lastImport.status === 'SUCCESS' ? 'sucesso' : status.lastImport.status}
            </p>
          ) : null}
          {syncMessage ? (
            <p className="form-success">{syncMessage}</p>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={syncing}
            onClick={() => void onSync()}
          >
            {syncing ? 'Atualizando...' : 'Atualizar base oficial agora'}
          </button>
        </section>
      ) : null}
    </div>
  );
}
