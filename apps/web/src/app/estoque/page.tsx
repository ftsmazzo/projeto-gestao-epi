'use client';

import type {
  EpiCategory,
  EpiItem,
  EpiStockBalance,
  EpiStockMovement,
  EpiStockMovementType,
  StockLocation,
  StockSummary,
} from '@gestao-epi/shared';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RequireAuth } from '../../components/RequireAuth';
import { listEpiItems } from '../../lib/epis';
import {
  createStockLocation,
  createStockMovement,
  getStockSummary,
  listStockBalances,
  listStockLocations,
  listStockMovements,
  updateStockLocation,
  updateStockLocationStatus,
} from '../../lib/stock';

type Panel = 'balances' | 'locations' | 'movements';
type LocationMode = 'closed' | 'create' | 'edit';
type MovementMode = 'closed' | 'open';

const CATEGORY_OPTIONS: { value: EpiCategory; label: string }[] = [
  { value: 'AUDITIVA', label: 'Auditiva' },
  { value: 'RESPIRATORIA', label: 'Respiratoria' },
  { value: 'QUEDA', label: 'Queda' },
  { value: 'MAOS', label: 'Maos' },
  { value: 'OLHOS', label: 'Olhos' },
  { value: 'CABECA', label: 'Cabeca' },
  { value: 'PES', label: 'Pes' },
  { value: 'TRONCO', label: 'Tronco' },
  { value: 'OUTROS', label: 'Outros' },
];

function variantLabel(
  variant:
    | {
        size: string | null;
        color: string | null;
        model: string | null;
        side?: string | null;
      }
    | null
    | undefined,
) {
  if (!variant) return 'Sem variacao';
  const parts = [variant.size, variant.color, variant.model, variant.side]
    .map((v) => v?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Variacao';
}

function movementTypeLabel(type: EpiStockMovementType) {
  switch (type) {
    case 'ENTRADA':
      return 'Entrada';
    case 'SAIDA_MANUAL':
      return 'Saida manual';
    case 'AJUSTE':
      return 'Ajuste';
    default:
      return type;
  }
}

function statusClass(status: EpiStockBalance['status']) {
  if (status === 'OK') return 'status-pill status-pill--active';
  if (status === 'BAIXO') return 'status-pill status-pill--warn';
  return 'status-pill status-pill--inactive';
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

function EstoqueContent() {
  const [panel, setPanel] = useState<Panel>('balances');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [balances, setBalances] = useState<EpiStockBalance[]>([]);
  const [movements, setMovements] = useState<EpiStockMovement[]>([]);
  const [epis, setEpis] = useState<EpiItem[]>([]);

  const [filterEpiId, setFilterEpiId] = useState('');
  const [filterLocationId, setFilterLocationId] = useState('');
  const [filterCategory, setFilterCategory] = useState<EpiCategory | ''>('');
  const [filterLowOnly, setFilterLowOnly] = useState(false);

  const [locationMode, setLocationMode] = useState<LocationMode>('closed');
  const [editingLocationId, setEditingLocationId] = useState<string | null>(
    null,
  );
  const [locationName, setLocationName] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSaving, setLocationSaving] = useState(false);

  const [movementMode, setMovementMode] = useState<MovementMode>('closed');
  const [movementType, setMovementType] =
    useState<EpiStockMovementType>('ENTRADA');
  const [movementLocationId, setMovementLocationId] = useState('');
  const [movementEpiId, setMovementEpiId] = useState('');
  const [movementVariantId, setMovementVariantId] = useState('');
  const [movementQuantity, setMovementQuantity] = useState('1');
  const [movementMinQuantity, setMovementMinQuantity] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [movementNotes, setMovementNotes] = useState('');
  const [movementError, setMovementError] = useState<string | null>(null);
  const [movementSaving, setMovementSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [locs, sums, episList, bals, movs] = await Promise.all([
        listStockLocations(),
        getStockSummary(),
        listEpiItems(),
        listStockBalances({
          epiItemId: filterEpiId || undefined,
          stockLocationId: filterLocationId || undefined,
          category: filterCategory || undefined,
          lowOnly: filterLowOnly,
        }),
        listStockMovements({ limit: 80 }),
      ]);
      setLocations(locs);
      setSummary(sums);
      setEpis(episList.filter((item) => item.isActive));
      setBalances(bals);
      setMovements(movs);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar o estoque.',
      );
    } finally {
      setLoading(false);
    }
  }, [filterEpiId, filterLocationId, filterCategory, filterLowOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedEpi = useMemo(
    () => epis.find((item) => item.id === movementEpiId) ?? null,
    [epis, movementEpiId],
  );

  const activeLocations = useMemo(
    () => locations.filter((item) => item.isActive),
    [locations],
  );

  function openCreateLocation() {
    setLocationMode('create');
    setEditingLocationId(null);
    setLocationName('');
    setLocationDescription('');
    setLocationError(null);
  }

  function openEditLocation(location: StockLocation) {
    setLocationMode('edit');
    setEditingLocationId(location.id);
    setLocationName(location.name);
    setLocationDescription(location.description ?? '');
    setLocationError(null);
  }

  function closeLocationForm() {
    setLocationMode('closed');
    setEditingLocationId(null);
    setLocationError(null);
  }

  async function onSubmitLocation(event: FormEvent) {
    event.preventDefault();
    setLocationError(null);
    setLocationSaving(true);
    try {
      const payload = {
        name: locationName.trim(),
        description: locationDescription.trim() || null,
      };
      if (locationMode === 'create') {
        await createStockLocation(payload);
      } else if (editingLocationId) {
        await updateStockLocation(editingLocationId, payload);
      }
      closeLocationForm();
      await load();
    } catch (err) {
      setLocationError(
        err instanceof Error ? err.message : 'Falha ao salvar local.',
      );
    } finally {
      setLocationSaving(false);
    }
  }

  async function toggleLocation(location: StockLocation) {
    setError(null);
    try {
      await updateStockLocationStatus(location.id, !location.isActive);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel atualizar o local.',
      );
    }
  }

  function openMovementForm() {
    setMovementMode('open');
    setMovementType('ENTRADA');
    setMovementLocationId(activeLocations[0]?.id ?? '');
    setMovementEpiId(epis[0]?.id ?? '');
    setMovementVariantId('');
    setMovementQuantity('1');
    setMovementMinQuantity('');
    setMovementReason('');
    setMovementNotes('');
    setMovementError(null);
  }

  function closeMovementForm() {
    setMovementMode('closed');
    setMovementError(null);
  }

  async function onSubmitMovement(event: FormEvent) {
    event.preventDefault();
    setMovementError(null);
    const quantity = Number(movementQuantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      setMovementError('Informe uma quantidade inteira valida.');
      return;
    }
    if (
      (movementType === 'SAIDA_MANUAL' || movementType === 'AJUSTE') &&
      !movementReason.trim()
    ) {
      setMovementError('Motivo e obrigatorio para saida manual e ajuste.');
      return;
    }

    setMovementSaving(true);
    try {
      await createStockMovement({
        type: movementType,
        stockLocationId: movementLocationId,
        epiItemId: movementEpiId,
        epiVariantId: movementVariantId || null,
        quantity,
        reason: movementReason.trim() || undefined,
        notes: movementNotes.trim() || undefined,
        minQuantity:
          movementMinQuantity.trim() === ''
            ? undefined
            : Number(movementMinQuantity),
      });
      closeMovementForm();
      await load();
    } catch (err) {
      setMovementError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel registrar a movimentacao.',
      );
    } finally {
      setMovementSaving(false);
    }
  }

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Operacao</p>
          <h1 className="page-title">Estoque</h1>
          <p className="page-lead">
            Locais de armazenamento, saldos por EPI/variacao e movimentacoes
            manuais (entrada, saida e ajuste).
          </p>
        </div>
        <div className="header-actions header-actions--wrap">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={openCreateLocation}
          >
            Novo local
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openMovementForm}
            disabled={activeLocations.length === 0 || epis.length === 0}
          >
            Registrar movimentacao
          </button>
        </div>
      </header>

      {summary ? (
        <section className="quota-summary" aria-label="Resumo de estoque">
          <div className="quota-summary-item">
            <span className="quota-summary-label">Locais ativos</span>
            <strong className="quota-summary-value">
              {summary.locationsActive}
            </strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Linhas de saldo</span>
            <strong className="quota-summary-value">
              {summary.balanceLines}
            </strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Unidades totais</span>
            <strong className="quota-summary-value">{summary.totalUnits}</strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Baixo estoque</span>
            <strong className="quota-summary-value">
              {summary.lowStockCount}
            </strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Zerados</span>
            <strong className="quota-summary-value">
              {summary.zeroStockCount}
            </strong>
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {activeLocations.length === 0 && !loading ? (
        <p className="caepi-message" role="status">
          Cadastre ao menos um local ativo para registrar movimentacoes.{' '}
          <Link href="/epis">Ver catalogo de EPIs</Link>
        </p>
      ) : null}

      {locationMode !== 'closed' ? (
        <section className="surface" aria-labelledby="stock-location-form">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">
                {locationMode === 'create' ? 'Novo local' : 'Editar local'}
              </p>
              <h2 id="stock-location-form" className="page-title page-title--sm">
                Local de estoque
              </h2>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeLocationForm}
            >
              Cancelar
            </button>
          </div>
          <form className="form form--wide" onSubmit={onSubmitLocation}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="stock-location-name">Nome</label>
                <input
                  id="stock-location-name"
                  required
                  minLength={2}
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                />
              </div>
              <div className="field field--span-2">
                <label htmlFor="stock-location-desc">Descricao (opcional)</label>
                <input
                  id="stock-location-desc"
                  value={locationDescription}
                  onChange={(e) => setLocationDescription(e.target.value)}
                />
              </div>
            </div>
            {locationError ? (
              <p className="error" role="alert">
                {locationError}
              </p>
            ) : null}
            <div className="btn-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={locationSaving}
              >
                {locationSaving ? 'Salvando...' : 'Salvar local'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {movementMode === 'open' ? (
        <section className="surface" aria-labelledby="stock-movement-form">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Movimentacao</p>
              <h2 id="stock-movement-form" className="page-title page-title--sm">
                Registrar movimentacao
              </h2>
              <p className="page-lead">
                Entrada adiciona saldo. Saida manual reduz. Ajuste define a
                quantidade final.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeMovementForm}
            >
              Cancelar
            </button>
          </div>
          <form className="form form--wide" onSubmit={onSubmitMovement}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="mov-type">Tipo</label>
                <select
                  id="mov-type"
                  value={movementType}
                  onChange={(e) =>
                    setMovementType(e.target.value as EpiStockMovementType)
                  }
                >
                  <option value="ENTRADA">Entrada</option>
                  <option value="SAIDA_MANUAL">Saida manual</option>
                  <option value="AJUSTE">Ajuste</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="mov-location">Local</label>
                <select
                  id="mov-location"
                  required
                  value={movementLocationId}
                  onChange={(e) => setMovementLocationId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {activeLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="mov-epi">EPI</label>
                <select
                  id="mov-epi"
                  required
                  value={movementEpiId}
                  onChange={(e) => {
                    setMovementEpiId(e.target.value);
                    setMovementVariantId('');
                  }}
                >
                  <option value="">Selecione...</option>
                  {epis.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.caNumber ? ` (CA ${item.caNumber})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="mov-variant">Variacao (opcional)</label>
                <select
                  id="mov-variant"
                  value={movementVariantId}
                  onChange={(e) => setMovementVariantId(e.target.value)}
                  disabled={!selectedEpi?.variants?.length}
                >
                  <option value="">Sem variacao</option>
                  {(selectedEpi?.variants ?? []).map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variantLabel(variant)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="mov-qty">
                  {movementType === 'AJUSTE'
                    ? 'Quantidade final'
                    : 'Quantidade'}
                </label>
                <input
                  id="mov-qty"
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={movementQuantity}
                  onChange={(e) => setMovementQuantity(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="mov-min">Estoque minimo (opcional)</label>
                <input
                  id="mov-min"
                  type="number"
                  min={0}
                  step={1}
                  value={movementMinQuantity}
                  onChange={(e) => setMovementMinQuantity(e.target.value)}
                />
              </div>
              <div className="field field--span-2">
                <label htmlFor="mov-reason">
                  Motivo
                  {movementType === 'ENTRADA' ? ' (opcional)' : ' (obrigatorio)'}
                </label>
                <input
                  id="mov-reason"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  required={
                    movementType === 'SAIDA_MANUAL' || movementType === 'AJUSTE'
                  }
                />
              </div>
              <div className="field field--span-2">
                <label htmlFor="mov-notes">
                  Observacao / nota fiscal (opcional)
                </label>
                <textarea
                  id="mov-notes"
                  rows={2}
                  value={movementNotes}
                  onChange={(e) => setMovementNotes(e.target.value)}
                />
              </div>
            </div>
            {movementError ? (
              <p className="error" role="alert">
                {movementError}
              </p>
            ) : null}
            <div className="btn-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={movementSaving}
              >
                {movementSaving ? 'Registrando...' : 'Confirmar movimentacao'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="btn-row" style={{ marginBottom: '0.75rem' }}>
        <button
          type="button"
          className={`btn ${panel === 'balances' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setPanel('balances')}
        >
          Saldos
        </button>
        <button
          type="button"
          className={`btn ${panel === 'locations' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setPanel('locations')}
        >
          Locais
        </button>
        <button
          type="button"
          className={`btn ${panel === 'movements' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setPanel('movements')}
        >
          Historico
        </button>
      </div>

      {panel === 'balances' ? (
        <section className="surface" aria-labelledby="stock-balances-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Saldos</p>
              <h2 id="stock-balances-title" className="page-title page-title--sm">
                Estoque disponivel
              </h2>
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <div className="field">
              <label htmlFor="filter-epi">EPI</label>
              <select
                id="filter-epi"
                value={filterEpiId}
                onChange={(e) => setFilterEpiId(e.target.value)}
              >
                <option value="">Todos</option>
                {epis.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="filter-location">Local</label>
              <select
                id="filter-location"
                value={filterLocationId}
                onChange={(e) => setFilterLocationId(e.target.value)}
              >
                <option value="">Todos</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="filter-category">Categoria</label>
              <select
                id="filter-category"
                value={filterCategory}
                onChange={(e) =>
                  setFilterCategory(e.target.value as EpiCategory | '')
                }
              >
                <option value="">Todas</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="filter-low">Status</label>
              <label className="field-check" htmlFor="filter-low">
                <input
                  id="filter-low"
                  type="checkbox"
                  checked={filterLowOnly}
                  onChange={(e) => setFilterLowOnly(e.target.checked)}
                />
                <span>Somente baixo / zerado</span>
              </label>
            </div>
          </div>

          {loading ? (
            <p className="page-lead">Carregando saldos...</p>
          ) : balances.length === 0 ? (
            <div className="empty-state">
              <p className="page-title page-title--sm">Nenhum saldo ainda</p>
              <p className="page-lead">
                Registre uma entrada para comecar a controlar o estoque.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={openMovementForm}
                disabled={activeLocations.length === 0 || epis.length === 0}
              >
                Registrar primeira entrada
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">EPI</th>
                    <th scope="col">Variacao</th>
                    <th scope="col">Local</th>
                    <th scope="col">Qtd</th>
                    <th scope="col">Minimo</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.epiItem?.name ?? '—'}</strong>
                        {row.epiItem?.caNumber ? (
                          <span className="table-sub">
                            CA {row.epiItem.caNumber}
                          </span>
                        ) : null}
                      </td>
                      <td>{variantLabel(row.epiVariant)}</td>
                      <td>{row.stockLocation?.name ?? '—'}</td>
                      <td className="mono">{row.quantity}</td>
                      <td className="mono">
                        {row.minQuantity == null ? '—' : row.minQuantity}
                      </td>
                      <td>
                        <span className={statusClass(row.status)}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {panel === 'locations' ? (
        <section className="surface" aria-labelledby="stock-locations-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Locais</p>
              <h2
                id="stock-locations-title"
                className="page-title page-title--sm"
              >
                Locais de estoque
              </h2>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openCreateLocation}
            >
              Novo local
            </button>
          </div>
          {locations.length === 0 ? (
            <div className="empty-state">
              <p className="page-title page-title--sm">Nenhum local</p>
              <p className="page-lead">
                Crie almoxarifados, salas ou pontos de retirada.
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">Descricao</th>
                    <th scope="col">Status</th>
                    <th scope="col">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((location) => (
                    <tr key={location.id}>
                      <td>
                        <strong>{location.name}</strong>
                      </td>
                      <td>{location.description || '—'}</td>
                      <td>
                        <span
                          className={`status-pill status-pill--${
                            location.isActive ? 'active' : 'inactive'
                          }`}
                        >
                          {location.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => openEditLocation(location)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => void toggleLocation(location)}
                          >
                            {location.isActive ? 'Inativar' : 'Reativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {panel === 'movements' ? (
        <section className="surface" aria-labelledby="stock-movements-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Historico</p>
              <h2
                id="stock-movements-title"
                className="page-title page-title--sm"
              >
                Movimentacoes
              </h2>
            </div>
          </div>
          {movements.length === 0 ? (
            <div className="empty-state">
              <p className="page-title page-title--sm">Sem movimentacoes</p>
              <p className="page-lead">
                As entradas, saidas e ajustes aparecerao aqui.
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Quando</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">EPI</th>
                    <th scope="col">Local</th>
                    <th scope="col">Qtd</th>
                    <th scope="col">Saldo</th>
                    <th scope="col">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>{movementTypeLabel(row.type)}</td>
                      <td>
                        <strong>{row.epiItem?.name ?? '—'}</strong>
                        <span className="table-sub">
                          {variantLabel(row.epiVariant)}
                        </span>
                      </td>
                      <td>{row.stockLocation?.name ?? '—'}</td>
                      <td className="mono">{row.quantity}</td>
                      <td className="mono">
                        {row.previousQuantity} → {row.newQuantity}
                      </td>
                      <td>
                        {row.reason || '—'}
                        {row.notes ? (
                          <span className="table-sub">{row.notes}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

export default function EstoquePage() {
  return (
    <RequireAuth>{() => <EstoqueContent />}</RequireAuth>
  );
}
