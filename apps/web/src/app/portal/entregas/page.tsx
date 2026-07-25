'use client';

import type {
  PortalDeliveryDetail,
  PortalDeliveryListItem,
  PortalEpiCoverageNeedRow,
  PortalEpiCoverageResponse,
  PortalEpiCoverageStatus,
  PortalEntregaWorkerOption,
  PortalEntregasPreparacaoResponse,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import {
  createPortalDelivery,
  fetchPortalDeliveries,
  fetchPortalEntregasPreparacao,
  fetchPortalWorkerEpiCoverage,
} from '../../../lib/client-auth';

type ItemSelection = {
  selected: boolean;
  epiItemId: string;
  stockLocationId: string;
  quantity: number;
};

function stripDiacritics(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function statusLabel(status: PortalEpiCoverageStatus) {
  switch (status) {
    case 'DISPONIVEL':
      return 'Disponivel';
    case 'SEM_ESTOQUE':
      return 'Sem estoque';
    case 'SEM_EPI_REAL_VINCULADO':
      return 'Sem EPI real';
    case 'SEM_REQUISITO':
      return 'Sem requisito';
    default:
      return status;
  }
}

function statusPillClass(status: PortalEpiCoverageStatus) {
  if (status === 'DISPONIVEL') return 'status-pill status-pill--active';
  if (status === 'SEM_ESTOQUE') return 'status-pill status-pill--warn';
  return 'status-pill status-pill--inactive';
}

function defaultSelection(row: PortalEpiCoverageNeedRow): ItemSelection {
  const epiId =
    row.suggestedEpiItemId ??
    row.linkedEpis.find((e) => e.totalQuantity > 0)?.epiItemId ??
    row.linkedEpis[0]?.epiItemId ??
    '';
  const epi = row.linkedEpis.find((e) => e.epiItemId === epiId);
  const balance =
    epi?.balances.find((b) => b.quantity > 0) ?? epi?.balances[0];
  return {
    selected: row.status === 'DISPONIVEL',
    epiItemId: epiId,
    stockLocationId: balance?.stockLocationId ?? '',
    quantity: Math.max(1, row.quantity || 1),
  };
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

function NeedSelectCard({
  row,
  selection,
  onChange,
}: {
  row: PortalEpiCoverageNeedRow;
  selection: ItemSelection;
  onChange: (next: ItemSelection) => void;
}) {
  const canSelect = row.status === 'DISPONIVEL';
  const epi =
    row.linkedEpis.find((e) => e.epiItemId === selection.epiItemId) ??
    row.linkedEpis[0];
  const balances = epi?.balances ?? [];

  return (
    <article
      className={`portal-coverage-need${selection.selected ? ' is-selected' : ''}`}
    >
      <header className="portal-coverage-need__header">
        <div>
          <label className="portal-need-select">
            <input
              type="checkbox"
              checked={selection.selected && canSelect}
              disabled={!canSelect}
              onChange={(e) =>
                onChange({ ...selection, selected: e.target.checked })
              }
            />
            <h3 className="portal-coverage-need__title">{row.needName}</h3>
          </label>
          <p className="table-sub">
            {row.isRequired ? 'Obrigatorio' : 'Recomendado'}
            {row.riskName ? ` · Risco: ${row.riskName}` : ''}
            {row.replacementLabel
              ? ` · Periodicidade: ${row.replacementLabel}`
              : ''}
          </p>
        </div>
        <span className={statusPillClass(row.status)}>
          {statusLabel(row.status)}
        </span>
      </header>

      {row.guidance ? (
        <p className="field-hint" role="status">
          {row.guidance}
          {row.status === 'SEM_ESTOQUE' ? (
            <>
              {' '}
              <Link href="/portal/estoque">Registrar entrada</Link>
            </>
          ) : null}
        </p>
      ) : null}

      {canSelect && selection.selected ? (
        <div className="form-grid form-grid--compact">
          <div className="field">
            <label>EPI real</label>
            <select
              value={selection.epiItemId}
              onChange={(e) => {
                const nextEpi = row.linkedEpis.find(
                  (item) => item.epiItemId === e.target.value,
                );
                const bal =
                  nextEpi?.balances.find((b) => b.quantity > 0) ??
                  nextEpi?.balances[0];
                onChange({
                  ...selection,
                  epiItemId: e.target.value,
                  stockLocationId: bal?.stockLocationId ?? '',
                });
              }}
            >
              {row.linkedEpis.map((item) => (
                <option
                  key={item.epiItemId}
                  value={item.epiItemId}
                  disabled={item.totalQuantity <= 0}
                >
                  {item.name} (saldo {item.totalQuantity})
                  {row.suggestedEpiItemId === item.epiItemId
                    ? ' — sugerido'
                    : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Local de estoque</label>
            <select
              value={selection.stockLocationId}
              onChange={(e) =>
                onChange({ ...selection, stockLocationId: e.target.value })
              }
            >
              {balances.length === 0 ? (
                <option value="">Sem saldo</option>
              ) : (
                balances.map((b) => (
                  <option
                    key={b.stockLocationId}
                    value={b.stockLocationId}
                    disabled={b.quantity <= 0}
                  >
                    {b.locationName} ({b.quantity})
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="field">
            <label>Quantidade</label>
            <input
              type="number"
              min={1}
              max={
                balances.find((b) => b.stockLocationId === selection.stockLocationId)
                  ?.quantity ?? undefined
              }
              value={selection.quantity}
              onChange={(e) =>
                onChange({
                  ...selection,
                  quantity: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}

function FacialCapture({
  blob,
  onCaptured,
  onClear,
}: {
  blob: Blob | null;
  onCaptured: (next: Blob) => void;
  onClear: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [stopCamera, previewUrl]);

  useEffect(() => {
    if (!blob) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, [blob]);

  async function startCamera() {
    setCameraError(null);
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Camera indisponivel neste navegador. Use HTTPS ou um dispositivo com camera.',
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel acessar a camera. Verifique a permissao do navegador.',
      );
      stopCamera();
    } finally {
      setStarting(false);
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !cameraOn) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (next) => {
        if (!next) {
          setCameraError('Falha ao capturar a imagem facial.');
          return;
        }
        onCaptured(next);
        stopCamera();
      },
      'image/jpeg',
      0.92,
    );
  }

  return (
    <section className="portal-facial" aria-labelledby="facial-title">
      <h2 id="facial-title" className="page-title page-title--sm">
        Evidencia facial
      </h2>
      <p className="field-hint" role="note">
        A imagem facial sera registrada como evidencia da entrega de EPI.
      </p>

      {cameraError ? (
        <p className="error" role="alert">
          {cameraError}
        </p>
      ) : null}

      <div className="portal-facial__stage">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Captura facial da entrega"
            className="portal-facial__preview"
          />
        ) : (
          <video
            ref={videoRef}
            className="portal-facial__preview"
            playsInline
            muted
            aria-label="Preview da camera"
          />
        )}
      </div>

      <div className="btn-row">
        {!previewUrl ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void startCamera()}
              disabled={starting || cameraOn}
            >
              {starting ? 'Abrindo camera...' : cameraOn ? 'Camera ativa' : 'Abrir camera'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={capture}
              disabled={!cameraOn}
            >
              Capturar foto
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              onClear();
              void startCamera();
            }}
          >
            Refazer foto
          </button>
        )}
      </div>
    </section>
  );
}

function PortalEntregasContent() {
  const [prep, setPrep] = useState<PortalEntregasPreparacaoResponse | null>(
    null,
  );
  const [coverage, setCoverage] = useState<PortalEpiCoverageResponse | null>(
    null,
  );
  const [history, setHistory] = useState<PortalDeliveryListItem[]>([]);
  const [receipt, setReceipt] = useState<PortalDeliveryDetail | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, ItemSelection>>(
    {},
  );
  const [facialBlob, setFacialBlob] = useState<Blob | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [unitId, setUnitId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [jobId, setJobId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadHistory = useCallback(async () => {
    try {
      const res = await fetchPortalDeliveries();
      setHistory(res.deliveries);
    } catch {
      // historico e secundario; nao bloquear a tela
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchPortalEntregasPreparacao(), fetchPortalDeliveries()])
      .then(([prepRes, histRes]) => {
        if (!cancelled) {
          setPrep(prepRes);
          setHistory(histRes.deliveries);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Falha ao carregar preparacao de entrega.',
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    };
  }, [receiptPreview]);

  const filteredWorkers = useMemo(() => {
    if (!prep) return [];
    const needle = stripDiacritics(query.trim());
    return prep.workers.filter((worker) => {
      if (unitId && worker.unitId !== unitId) return false;
      if (sectorId && worker.sectorId !== sectorId) return false;
      if (jobId && worker.jobFunctionId !== jobId) return false;
      if (!needle) return true;
      const hay = stripDiacritics(
        [
          worker.name,
          worker.registration ?? '',
          worker.cpfMasked ?? '',
          worker.jobFunctionName ?? '',
          worker.sectorName ?? '',
          worker.unitName ?? '',
        ].join(' '),
      );
      return hay.includes(needle);
    });
  }, [prep, query, unitId, sectorId, jobId]);

  const jobsForFilter = useMemo(() => {
    if (!prep) return [];
    if (!sectorId) return prep.filters.jobs;
    return prep.filters.jobs.filter((job) => job.sectorId === sectorId);
  }, [prep, sectorId]);

  const selectedItems = useMemo(() => {
    if (!coverage) return [];
    return coverage.needs
      .filter((need) => selections[need.epiNeedId]?.selected)
      .map((need) => ({ need, sel: selections[need.epiNeedId]! }));
  }, [coverage, selections]);

  const canSubmit =
    Boolean(selectedId) &&
    selectedItems.length > 0 &&
    selectedItems.every(
      (row) =>
        row.sel.epiItemId &&
        row.sel.stockLocationId &&
        row.sel.quantity > 0,
    ) &&
    Boolean(facialBlob) &&
    !submitting;

  async function selectWorker(worker: PortalEntregaWorkerOption) {
    setSelectedId(worker.id);
    setReceipt(null);
    setFacialBlob(null);
    setNotes('');
    setLoadingCoverage(true);
    setError(null);
    try {
      const res = await fetchPortalWorkerEpiCoverage(worker.id);
      setCoverage(res);
      const next: Record<string, ItemSelection> = {};
      for (const need of res.needs) {
        next[need.epiNeedId] = defaultSelection(need);
      }
      setSelections(next);
    } catch (err) {
      setCoverage(null);
      setSelections({});
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar cobertura de EPIs.',
      );
    } finally {
      setLoadingCoverage(false);
    }
  }

  async function submitDelivery() {
    if (!selectedId || !facialBlob) {
      setError('Capture a evidencia facial antes de confirmar a entrega.');
      return;
    }
    if (selectedItems.length === 0) {
      setError('Selecione ao menos um EPI disponivel para entregar.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const detail = await createPortalDelivery(
        {
          workerId: selectedId,
          notes: notes.trim() || null,
          items: selectedItems.map(({ need, sel }) => ({
            epiNeedId: need.epiNeedId,
            epiItemId: sel.epiItemId,
            stockLocationId: sel.stockLocationId,
            quantity: sel.quantity,
          })),
        },
        facialBlob,
      );
      setReceipt(detail);
      const url = URL.createObjectURL(facialBlob);
      setReceiptPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setFacialBlob(null);
      const refreshed = await fetchPortalWorkerEpiCoverage(selectedId);
      setCoverage(refreshed);
      const next: Record<string, ItemSelection> = {};
      for (const need of refreshed.needs) {
        next[need.epiNeedId] = defaultSelection(need);
      }
      setSelections(next);
      await reloadHistory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao registrar a entrega.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="portal-home">
      <header className="portal-home-header">
        <div>
          <p className="page-kicker">Dia a dia</p>
          <h1 className="page-title page-title--sm">Entrega de EPI</h1>
          <p className="page-lead">
            Selecione o trabalhador, os EPIs disponiveis, capture a evidencia
            facial e confirme a entrega com baixa automatica de estoque.
          </p>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="page-lead">Carregando trabalhadores...</p> : null}

      {receipt ? (
        <section className="portal-card" aria-labelledby="receipt-title">
          <h2 id="receipt-title" className="page-title page-title--sm">
            Entrega registrada
          </h2>
          <p>
            <strong>{receipt.worker.name}</strong>
            {receipt.worker.registration
              ? ` · Mat. ${receipt.worker.registration}`
              : ''}
          </p>
          <p className="table-sub">
            {formatDateTime(receipt.deliveredAt)} · Operador:{' '}
            {receipt.deliveredBy.name}
          </p>
          <ul className="portal-coverage-epis">
            {receipt.items.map((item) => (
              <li key={item.id}>
                <strong>
                  {item.needName} → {item.epiName}
                </strong>
                <span className="table-sub">
                  Qtd {item.quantity} · {item.locationName}
                  {item.stockMovement
                    ? ` · Saldo ${item.stockMovement.previousQuantity} → ${item.stockMovement.newQuantity}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
          {receiptPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={receiptPreview}
              alt="Evidencia facial capturada"
              className="portal-facial__preview portal-facial__preview--receipt"
            />
          ) : (
            <p className="field-hint">Evidencia facial capturada e arquivada.</p>
          )}
          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setReceipt(null);
                setReceiptPreview((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return null;
                });
              }}
            >
              Nova entrega
            </button>
            <Link className="btn btn-secondary" href="/portal/estoque">
              Ver estoque
            </Link>
          </div>
        </section>
      ) : null}

      {prep && !receipt ? (
        <>
          <section className="quota-summary" aria-label="Resumo">
            <div className="quota-summary-item">
              <span className="quota-summary-label">Ativos</span>
              <strong className="quota-summary-value">
                {prep.summary.activeWorkers}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Com funcao</span>
              <strong className="quota-summary-value">
                {prep.summary.withJobFunction}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Sem funcao</span>
              <strong className="quota-summary-value">
                {prep.summary.withoutJobFunction}
              </strong>
            </div>
          </section>

          <section className="portal-card" aria-labelledby="worker-select-title">
            <h2 id="worker-select-title" className="page-title page-title--sm">
              1. Trabalhador
            </h2>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="entrega-worker-search">Buscar</label>
                <input
                  id="entrega-worker-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nome, matricula ou CPF mascarado"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="entrega-unit">Unidade</label>
                <select
                  id="entrega-unit"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                >
                  <option value="">Todas</option>
                  {prep.filters.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="entrega-sector">Setor</label>
                <select
                  id="entrega-sector"
                  value={sectorId}
                  onChange={(e) => {
                    setSectorId(e.target.value);
                    setJobId('');
                  }}
                >
                  <option value="">Todos</option>
                  {prep.filters.sectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="entrega-job">Funcao</label>
                <select
                  id="entrega-job"
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                >
                  <option value="">Todas</option>
                  {jobsForFilter.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Matricula</th>
                    <th>Unidade</th>
                    <th>Setor</th>
                    <th>Funcao</th>
                    <th>EPIs</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkers.length === 0 ? (
                    <tr>
                      <td colSpan={7}>Nenhum trabalhador ativo encontrado.</td>
                    </tr>
                  ) : (
                    filteredWorkers.map((worker) => (
                      <tr
                        key={worker.id}
                        className={
                          selectedId === worker.id ? 'is-selected-row' : undefined
                        }
                      >
                        <td>
                          <strong>{worker.name}</strong>
                          {worker.cpfMasked ? (
                            <span className="table-sub mono">
                              {worker.cpfMasked}
                            </span>
                          ) : null}
                        </td>
                        <td className="mono">{worker.registration ?? '—'}</td>
                        <td>{worker.unitName ?? '—'}</td>
                        <td>{worker.sectorName ?? '—'}</td>
                        <td>
                          {worker.jobFunctionName ?? (
                            <span className="status-pill status-pill--warn">
                              Sem funcao
                            </span>
                          )}
                        </td>
                        <td className="mono">{worker.requiredEpiCount}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => void selectWorker(worker)}
                          >
                            Selecionar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="portal-card" aria-labelledby="coverage-title">
            <h2 id="coverage-title" className="page-title page-title--sm">
              2. EPIs a entregar
            </h2>
            {!selectedId ? (
              <p className="page-lead">
                Selecione um trabalhador para ver os EPIs necessarios.
              </p>
            ) : null}
            {loadingCoverage ? (
              <p className="page-lead">Carregando cobertura...</p>
            ) : null}

            {coverage ? (
              <>
                <div className="portal-coverage-worker">
                  <p>
                    <strong>{coverage.worker.name}</strong>
                    {coverage.worker.registration
                      ? ` · Mat. ${coverage.worker.registration}`
                      : ''}
                  </p>
                  <p className="table-sub">
                    {coverage.worker.unitName ?? 'Sem unidade'}
                    {' · '}
                    {coverage.worker.sectorName ?? 'Sem setor'}
                    {' · '}
                    {coverage.worker.jobFunctionName ?? 'Sem funcao'}
                  </p>
                </div>

                {coverage.summary.message ? (
                  <p
                    className={
                      coverage.summary.status === 'OK'
                        ? 'notice notice--info'
                        : 'notice notice--warn'
                    }
                    role="status"
                  >
                    {coverage.summary.message}
                  </p>
                ) : null}

                {coverage.needs.length === 0 ? (
                  <p className="page-lead">
                    {coverage.summary.message ??
                      'Nenhum EPI necessario para este trabalhador.'}
                  </p>
                ) : (
                  <div className="portal-coverage-list">
                    {coverage.needs.map((need) => (
                      <NeedSelectCard
                        key={need.requirementId}
                        row={need}
                        selection={
                          selections[need.epiNeedId] ?? defaultSelection(need)
                        }
                        onChange={(next) =>
                          setSelections((prev) => ({
                            ...prev,
                            [need.epiNeedId]: next,
                          }))
                        }
                      />
                    ))}
                  </div>
                )}

                <div className="field" style={{ marginTop: '1rem' }}>
                  <label htmlFor="entrega-notes">Observacoes (opcional)</label>
                  <textarea
                    id="entrega-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={2000}
                  />
                </div>
              </>
            ) : null}
          </section>

          {coverage && coverage.needs.some((n) => n.status === 'DISPONIVEL') ? (
            <>
              <section className="portal-card">
                <FacialCapture
                  blob={facialBlob}
                  onCaptured={setFacialBlob}
                  onClear={() => setFacialBlob(null)}
                />
              </section>

              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canSubmit}
                  onClick={() => void submitDelivery()}
                >
                  {submitting
                    ? 'Registrando...'
                    : 'Registrar entrega com facial'}
                </button>
                <Link className="btn btn-secondary" href="/portal/estoque">
                  Ir ao estoque
                </Link>
                <Link className="btn btn-secondary" href="/portal">
                  Voltar ao painel
                </Link>
              </div>
              {!facialBlob ? (
                <p className="field-hint">
                  A confirmacao exige captura facial obrigatoria.
                </p>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <section
        className="portal-card"
        aria-labelledby="history-title"
        style={{ marginTop: '1.25rem' }}
      >
        <h2 id="history-title" className="page-title page-title--sm">
          Historico recente
        </h2>
        {history.length === 0 ? (
          <p className="page-lead">Nenhuma entrega registrada ainda.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Trabalhador</th>
                  <th>Itens</th>
                  <th>Operador</th>
                  <th>Metodo</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.deliveredAt)}</td>
                    <td>
                      <strong>{row.worker.name}</strong>
                      {row.worker.registration ? (
                        <span className="table-sub">
                          Mat. {row.worker.registration}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {row.items
                        .map((item) => `${item.needName} (${item.quantity})`)
                        .join(', ')}
                    </td>
                    <td>{row.deliveredBy.name}</td>
                    <td>{row.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function PortalEntregasPage() {
  return (
    <RequireClientAuth>
      {() => <PortalEntregasContent />}
    </RequireClientAuth>
  );
}
