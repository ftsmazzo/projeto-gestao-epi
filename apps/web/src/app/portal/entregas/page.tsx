'use client';

import type {
  PortalDeliveryDetail,
  PortalDeliveryListItem,
  PortalEpiCoverageNeedRow,
  PortalEpiCoverageResponse,
  PortalEpiCoverageStatus,
  PortalEntregaWorkerOption,
  PortalEntregasPreparacaoResponse,
  PortalStockBalanceRow,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FacialValidationPanel,
  type FacialValidationResult,
} from '../../../components/FacialValidationPanel';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import { WizardSteps } from '../../../components/ui/WizardSteps';
import {
  createPortalDelivery,
  fetchPortalDeliveries,
  fetchPortalEntregasPreparacao,
  fetchPortalEstoque,
  fetchPortalWorkerEpiCoverage,
} from '../../../lib/client-auth';

const DELIVERY_STEPS = [
  { id: 'worker', label: 'Trabalhador' },
  { id: 'epis', label: 'EPIs' },
  { id: 'face', label: 'Biometria' },
] as const;

/** Sem busca/filtro, nao despeja centenas de cards na tela. */
const WORKER_LIST_SOFT_CAP = 20;

type ItemSelection = {
  selected: boolean;
  epiItemId: string;
  stockLocationId: string;
  quantity: number;
  usefulLifeValue: string;
  usefulLifeUnit: 'DIAS' | 'MESES' | 'ANOS';
};

type ExtraSelection = {
  key: string;
  epiItemId: string;
  epiName: string;
  caNumber: string | null;
  stockLocationId: string;
  locationName: string;
  availableQuantity: number;
  quantity: number;
  usefulLifeValue: string;
  usefulLifeUnit: 'DIAS' | 'MESES' | 'ANOS';
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

function toCalendarDays(
  value?: number | null,
  unit?: string | null,
): number | null {
  if (value == null || value <= 0) return null;
  if (unit === 'MESES') return value * 30;
  if (unit === 'ANOS') return value * 365;
  if (unit === 'DIAS' || !unit) return value;
  return value;
}

function lifeDefaultsFromRow(
  row: PortalEpiCoverageNeedRow,
  epiItemId: string,
): Pick<
  ItemSelection,
  'usefulLifeValue' | 'usefulLifeUnit'
> {
  const epi = row.linkedEpis.find((e) => e.epiItemId === epiItemId);
  const fromEpi =
    epi?.usefulLifeDays ??
    toCalendarDays(epi?.usefulLifeValue, epi?.usefulLifeUnit);
  const fromNeed =
    row.suggestedUsefulLifeDays ??
    toCalendarDays(
      row.suggestedUsefulLifeValue,
      row.suggestedUsefulLifeUnit,
    );
  const days =
    fromEpi != null && fromEpi === 1 && fromNeed != null && fromNeed > 1
      ? fromNeed
      : (fromEpi ??
        fromNeed ??
        (row.replacementIntervalDays != null &&
        row.replacementIntervalDays > 1
          ? row.replacementIntervalDays
          : null));
  return {
    usefulLifeValue: days != null ? String(days) : '',
    usefulLifeUnit: 'DIAS',
  };
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
    ...lifeDefaultsFromRow(row, epiId),
  };
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

function NeedPickRow({
  row,
  selection,
  onChange,
}: {
  row: PortalEpiCoverageNeedRow;
  selection: ItemSelection;
  onChange: (next: ItemSelection) => void;
}) {
  const canSelect = row.status === 'DISPONIVEL';

  return (
    <label
      className={`portal-epi-pick${selection.selected && canSelect ? ' is-selected' : ''}${!canSelect ? ' is-disabled' : ''}`}
    >
      <input
        type="checkbox"
        checked={selection.selected && canSelect}
        disabled={!canSelect}
        onChange={(e) =>
          onChange({ ...selection, selected: e.target.checked })
        }
      />
      <div className="portal-epi-pick__body">
        <div className="portal-epi-pick__top">
          <strong>{row.needName}</strong>
          <span className={statusPillClass(row.status)}>
            {statusLabel(row.status)}
          </span>
        </div>
        {row.risks.length > 0 ? (
          <p className="portal-risk-chips" aria-label="Riscos associados">
            {row.risks.map((risk) => (
              <span key={risk.id} className="portal-risk-chip">
                {risk.name}
              </span>
            ))}
          </p>
        ) : (
          <p className="table-sub">
            {row.isRequired ? 'Obrigatorio' : 'Recomendado'}
          </p>
        )}
        {!canSelect && row.guidance ? (
          <p className="field-hint">
            {row.guidance}{' '}
            {row.status === 'SEM_ESTOQUE' ? (
              <Link href="/portal/estoque">Registrar entrada</Link>
            ) : null}
          </p>
        ) : null}
      </div>
    </label>
  );
}

function NeedConfigPanel({
  row,
  selection,
  onChange,
  index,
  total,
}: {
  row: PortalEpiCoverageNeedRow;
  selection: ItemSelection;
  onChange: (next: ItemSelection) => void;
  index: number;
  total: number;
}) {
  const epi =
    row.linkedEpis.find((e) => e.epiItemId === selection.epiItemId) ??
    row.linkedEpis[0];
  const balances = epi?.balances ?? [];

  return (
    <article className="portal-epi-config">
      <header className="portal-epi-config__head">
        <p className="page-kicker">
          EPI {index + 1} de {total}
        </p>
        <h3 className="page-title page-title--sm">{row.needName}</h3>
        {row.risks.length > 0 ? (
          <p className="portal-risk-chips" aria-label="Riscos associados">
            <span className="table-sub">Riscos:</span>{' '}
            {row.risks.map((risk) => (
              <span key={risk.id} className="portal-risk-chip">
                {risk.name}
              </span>
            ))}
          </p>
        ) : null}
      </header>

      <div className="form-grid form-grid--compact portal-epi-config__form">
        <div className="field field--span-2">
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
                ...lifeDefaultsFromRow(row, e.target.value),
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
                {row.suggestedEpiItemId === item.epiItemId ? ' — sugerido' : ''}
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
              balances.find(
                (b) => b.stockLocationId === selection.stockLocationId,
              )?.quantity ?? undefined
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
        <div className="field">
          <label>Vida util (dias corridos)</label>
          <input
            type="number"
            min={1}
            placeholder="Ex.: 180"
            value={selection.usefulLifeValue}
            onChange={(e) =>
              onChange({
                ...selection,
                usefulLifeValue: e.target.value,
                usefulLifeUnit: 'DIAS',
              })
            }
          />
          <p className="field-hint">
            Dias de calendario a partir da entrega. Botina 180, plug 30, PFF 3.
          </p>
        </div>
      </div>
    </article>
  );
}

function PortalEntregasContent() {
  const searchParams = useSearchParams();
  const workerFromQuery = searchParams.get('worker');
  const autoSelectedRef = useRef<string | null>(null);
  const coverageSectionRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [prep, setPrep] = useState<PortalEntregasPreparacaoResponse | null>(
    null,
  );
  const [coverage, setCoverage] = useState<PortalEpiCoverageResponse | null>(
    null,
  );
  const [history, setHistory] = useState<PortalDeliveryListItem[]>([]);
  const [receipt, setReceipt] = useState<PortalDeliveryDetail | null>(null);
  const [selections, setSelections] = useState<Record<string, ItemSelection>>(
    {},
  );
  const [extraItems, setExtraItems] = useState<ExtraSelection[]>([]);
  const [stockBalances, setStockBalances] = useState<PortalStockBalanceRow[]>(
    [],
  );
  const [extraQuery, setExtraQuery] = useState('');
  const [facialResult, setFacialResult] =
    useState<FacialValidationResult | null>(null);
  const [faceMatched, setFaceMatched] = useState(false);
  const [facePreviewUrl, setFacePreviewUrl] = useState<string | null>(null);
  const [faceFlowOpen, setFaceFlowOpen] = useState(false);
  const [faceFlowStep, setFaceFlowStep] = useState<'scan' | 'confirm'>('scan');
  const [faceScanKey, setFaceScanKey] = useState(0);
  const [epiPhase, setEpiPhase] = useState<'pick' | 'configure'>('pick');
  const [epiConfigIndex, setEpiConfigIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workerPickerOpen, setWorkerPickerOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [unitId, setUnitId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [jobId, setJobId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyStatus, setHistoryStatus] = useState('');

  const reloadHistory = useCallback(async () => {
    try {
      const res = await fetchPortalDeliveries(historyStatus || undefined);
      setHistory(res.deliveries);
    } catch {
      // historico e secundario; nao bloquear a tela
    }
  }, [historyStatus]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchPortalEntregasPreparacao(),
      fetchPortalDeliveries(historyStatus || undefined),
    ])
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
  }, [historyStatus]);

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

  const hasWorkerRefine = Boolean(
    query.trim() || unitId || sectorId || jobId,
  );
  const workersToShow = useMemo(() => {
    if (hasWorkerRefine) return filteredWorkers;
    return filteredWorkers.slice(0, WORKER_LIST_SOFT_CAP);
  }, [filteredWorkers, hasWorkerRefine]);
  const workerListTruncated =
    !hasWorkerRefine && filteredWorkers.length > WORKER_LIST_SOFT_CAP;

  const selectedWorkerOption = useMemo(() => {
    if (!selectedId || !prep) return null;
    return prep.workers.find((w) => w.id === selectedId) ?? null;
  }, [prep, selectedId]);

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

  const totalPickedCount = selectedItems.length + extraItems.length;
  const configRow = selectedItems[epiConfigIndex] ?? null;

  const extrasConfigured =
    extraItems.length > 0 &&
    extraItems.every(
      (row) =>
        row.epiItemId &&
        row.stockLocationId &&
        row.quantity > 0 &&
        row.quantity <= row.availableQuantity &&
        row.usefulLifeValue.trim() !== '',
    );

  const canProceedToFace =
    Boolean(selectedId) &&
    Boolean(coverage?.workerHasBiometricTemplate) &&
    coverage?.biometricConsentStatus === 'GRANTED' &&
    totalPickedCount > 0 &&
    (selectedItems.length === 0 ||
      selectedItems.every(
        (row) =>
          row.sel.epiItemId &&
          row.sel.stockLocationId &&
          row.sel.quantity > 0 &&
          row.sel.usefulLifeValue.trim() !== '',
      )) &&
    (extraItems.length === 0 || extrasConfigured) &&
    !submitting;

  const canSubmit =
    canProceedToFace && faceMatched && Boolean(facialResult) && !submitting;

  const availableExtraBalances = useMemo(() => {
    const taken = new Set(extraItems.map((row) => row.epiItemId));
    const q = stripDiacritics(extraQuery.trim());
    return stockBalances
      .filter((row) => row.quantity > 0 && !taken.has(row.epiItemId))
      .filter((row) => {
        if (!q) return true;
        const hay = stripDiacritics(
          `${row.epiName} ${row.caNumber ?? ''} ${row.locationName}`,
        );
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [stockBalances, extraItems, extraQuery]);

  function addExtraFromBalance(row: PortalStockBalanceRow) {
    const life =
      row.usefulLifeValue != null && row.usefulLifeValue > 0
        ? {
            usefulLifeValue: String(row.usefulLifeValue),
            usefulLifeUnit: (row.usefulLifeUnit ?? 'DIAS') as
              | 'DIAS'
              | 'MESES'
              | 'ANOS',
          }
        : { usefulLifeValue: '30', usefulLifeUnit: 'DIAS' as const };
    setExtraItems((prev) => [
      ...prev,
      {
        key: `${row.epiItemId}:${row.stockLocationId}:${Date.now()}`,
        epiItemId: row.epiItemId,
        epiName: row.epiName,
        caNumber: row.caNumber,
        stockLocationId: row.stockLocationId,
        locationName: row.locationName,
        availableQuantity: row.quantity,
        quantity: 1,
        ...life,
      },
    ]);
    setExtraQuery('');
  }

  const resetFacial = useCallback(() => {
    setFacialResult(null);
    setFaceMatched(false);
    setFacePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const closeFaceFlow = useCallback(() => {
    setFaceFlowOpen(false);
    setFaceFlowStep('scan');
    resetFacial();
  }, [resetFacial]);

  function openFaceFlow() {
    if (!canProceedToFace) {
      setError(
        'Selecione ao menos um EPI disponivel e confira estoque/biometria antes de continuar.',
      );
      return;
    }
    setError(null);
    resetFacial();
    setFaceFlowStep('scan');
    setFaceScanKey((k) => k + 1);
    setFaceFlowOpen(true);
  }

  const onFaceMatched = useCallback(
    (result: FacialValidationResult) => {
      setFacialResult(result);
      setFaceMatched(true);
      setFacePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(result.blob);
      });
      setError(null);
      setFaceFlowStep('confirm');
    },
    [],
  );

  useEffect(() => {
    if (!faceFlowOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('delivery-face-open');
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove('delivery-face-open');
    };
  }, [faceFlowOpen]);

  async function selectWorker(worker: PortalEntregaWorkerOption) {
    setSelectedId(worker.id);
    setReceipt(null);
    closeFaceFlow();
    setNotes('');
    setExtraItems([]);
    setExtraQuery('');
    setEpiPhase('pick');
    setEpiConfigIndex(0);
    setLoadingCoverage(true);
    setError(null);
    try {
      const [res, estoque] = await Promise.all([
        fetchPortalWorkerEpiCoverage(worker.id),
        fetchPortalEstoque(),
      ]);
      setCoverage(res);
      setStockBalances(estoque.balances);
      const next: Record<string, ItemSelection> = {};
      for (const need of res.needs) {
        next[need.epiNeedId] = defaultSelection(need);
      }
      setSelections(next);
      setWorkerPickerOpen(false);
    } catch (err) {
      setCoverage(null);
      setSelections({});
      setStockBalances([]);
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar cobertura de EPIs.',
      );
    } finally {
      setLoadingCoverage(false);
    }
  }

  function openWorkerPicker() {
    setWorkerPickerOpen(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  }

  useEffect(() => {
    if (workerPickerOpen || loadingCoverage || !coverage || !selectedId) return;
    const t = window.setTimeout(() => {
      coverageSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
    return () => window.clearTimeout(t);
  }, [workerPickerOpen, loadingCoverage, coverage, selectedId]);

  useEffect(() => {
    if (!prep || !workerFromQuery) return;
    if (autoSelectedRef.current === workerFromQuery) return;
    const worker = prep.workers.find((w) => w.id === workerFromQuery);
    if (!worker) return;
    autoSelectedRef.current = workerFromQuery;
    void selectWorker(worker);
  }, [prep, workerFromQuery]);

  async function submitDelivery() {
    if (!selectedId || !facialResult || !faceMatched) {
      setError('Valide a face antes de registrar a entrega.');
      return;
    }
    if (!coverage?.workerHasBiometricTemplate) {
      setError(
        'Este trabalhador ainda nao possui biometria facial cadastrada.',
      );
      return;
    }
    if (totalPickedCount === 0) {
      setError('Selecione ao menos um EPI para entregar.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const detail = await createPortalDelivery(
        {
          workerId: selectedId,
          notes: notes.trim() || null,
          facialEvidenceConsentAccepted: true,
          faceDescriptor: facialResult.descriptor,
          faceEngine: facialResult.faceEngine,
          faceEngineVersion: facialResult.faceEngineVersion,
          livenessPassed: facialResult.livenessPassed,
          livenessChallenge: facialResult.livenessChallenge,
          items: [
            ...selectedItems.map(({ need, sel }) => {
              const lifeRaw = Number(sel.usefulLifeValue);
              return {
                epiNeedId: need.epiNeedId,
                epiItemId: sel.epiItemId,
                stockLocationId: sel.stockLocationId,
                quantity: sel.quantity,
                usefulLifeValue:
                  Number.isFinite(lifeRaw) && lifeRaw > 0 ? lifeRaw : null,
                usefulLifeUnit:
                  Number.isFinite(lifeRaw) && lifeRaw > 0
                    ? sel.usefulLifeUnit
                    : null,
              };
            }),
            ...extraItems.map((item) => {
              const lifeRaw = Number(item.usefulLifeValue);
              return {
                isExtra: true,
                epiItemId: item.epiItemId,
                stockLocationId: item.stockLocationId,
                quantity: item.quantity,
                usefulLifeValue:
                  Number.isFinite(lifeRaw) && lifeRaw > 0 ? lifeRaw : null,
                usefulLifeUnit:
                  Number.isFinite(lifeRaw) && lifeRaw > 0
                    ? item.usefulLifeUnit
                    : null,
              };
            }),
          ],
        },
        facialResult.blob,
      );
      setReceipt(detail);
      setFaceFlowOpen(false);
      setFaceFlowStep('scan');
      resetFacial();
      const refreshed = await fetchPortalWorkerEpiCoverage(selectedId);
      setCoverage(refreshed);
      const next: Record<string, ItemSelection> = {};
      for (const need of refreshed.needs) {
        next[need.epiNeedId] = defaultSelection(need);
      }
      setSelections(next);
      setExtraItems([]);
      setExtraQuery('');
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
      <header className="portal-home-header portal-home-header--decision">
        <div>
          <p className="page-kicker">Dia a dia</p>
          <h1 className="page-title page-title--sm">Entrega de EPI</h1>
          <p className="page-lead">
            Busque o trabalhador, escolha os EPIs e valide a face em tela cheia.
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
        <section
          className="portal-card receipt-success"
          aria-labelledby="receipt-title"
        >
          <p className="receipt-success__badge">Entrega concluida</p>
          <h2 id="receipt-title" className="page-title page-title--sm">
            Comprovante gerado
          </h2>
          <p className="portal-receipt__code mono">{receipt.receiptNumber}</p>
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
          {receipt.evidence?.verificationStatus === 'MATCHED' ? (
            <p className="notice notice--ok" role="status">
              Biometria facial: aprovada automaticamente
            </p>
          ) : null}
          {receipt.consent.accepted ? (
            <p className="field-hint" role="note">
              Evidencia facial registrada no ato da entrega
              {receipt.consent.version
                ? ` (${receipt.consent.version})`
                : ''}
              .
            </p>
          ) : null}
          <div className="flow-sticky-bar">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setReceipt(null);
                setSelectedId(null);
                setCoverage(null);
                setSelections({});
                setWorkerPickerOpen(true);
                closeFaceFlow();
              }}
            >
              Nova entrega
            </button>
            <Link
              className="btn btn-primary"
              href={`/portal/entregas/${receipt.id}`}
            >
              Ver comprovante / imprimir
            </Link>
          </div>
        </section>
      ) : null}

      {prep && !receipt ? (
        <>
          <WizardSteps
            label="Etapas da entrega"
            steps={[...DELIVERY_STEPS]}
            currentId={
              !selectedId
                ? 'worker'
                : faceFlowOpen
                  ? 'face'
                  : 'epis'
            }
          />

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

            {selectedId && !workerPickerOpen ? (
              <div className="portal-selected-worker" role="status">
                <div className="portal-selected-worker__main">
                  <strong className="portal-selected-worker__title">
                    {coverage?.worker.name ??
                      selectedWorkerOption?.name ??
                      'Trabalhador selecionado'}
                  </strong>
                  <p className="portal-selected-worker__meta">
                    {(coverage?.worker.registration ??
                      selectedWorkerOption?.registration)
                      ? `Mat. ${coverage?.worker.registration ?? selectedWorkerOption?.registration}`
                      : 'Sem matricula'}
                    {' · '}
                    {coverage?.worker.unitName ??
                      selectedWorkerOption?.unitName ??
                      'Sem unidade'}
                    {' · '}
                    {coverage?.worker.sectorName ??
                      selectedWorkerOption?.sectorName ??
                      'Sem setor'}
                    {' · '}
                    {coverage?.worker.jobFunctionName ??
                      selectedWorkerOption?.jobFunctionName ??
                      'Sem funcao'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={openWorkerPicker}
                >
                  Trocar
                </button>
              </div>
            ) : (
              <>
                <p className="field-hint">
                  Busque por nome ou matricula — com muitos trabalhadores, a
                  lista so mostra um trecho ate voce filtrar.
                </p>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="entrega-worker-search">Buscar</label>
                    <input
                      ref={searchInputRef}
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

                <p className="field-hint" style={{ marginTop: '0.65rem' }}>
                  {filteredWorkers.length === 0
                    ? 'Nenhum resultado com os filtros atuais.'
                    : workerListTruncated
                      ? `Mostrando ${workersToShow.length} de ${filteredWorkers.length}. Digite na busca ou filtre por setor/funcao.`
                      : `${filteredWorkers.length} trabalhador(es)`}
                </p>

                <div
                  className="portal-pick-list portal-pick-list--scroll"
                  role="list"
                  aria-label="Trabalhadores"
                >
                  {workersToShow.length === 0 ? (
                    <p className="page-lead">
                      Nenhum trabalhador ativo encontrado.
                    </p>
                  ) : (
                    workersToShow.map((worker) => {
                      const selected = selectedId === worker.id;
                      return (
                        <article
                          key={worker.id}
                          role="listitem"
                          className={`portal-pick-card${selected ? ' is-selected' : ''}`}
                        >
                          <div className="portal-pick-card__body">
                            <div className="portal-pick-card__main">
                              <strong className="portal-pick-card__title">
                                {worker.name}
                              </strong>
                              <p className="portal-pick-card__meta">
                                {worker.registration
                                  ? `Mat. ${worker.registration}`
                                  : 'Sem matricula'}
                                {worker.cpfMasked
                                  ? ` · ${worker.cpfMasked}`
                                  : ''}
                              </p>
                              <p className="portal-pick-card__meta">
                                {worker.unitName ?? 'Sem unidade'}
                                {' · '}
                                {worker.sectorName ?? 'Sem setor'}
                              </p>
                              <p className="portal-pick-card__meta">
                                {worker.jobFunctionName ?? 'Sem funcao'}
                                {' · '}
                                {worker.requiredEpiCount} EPI
                                {worker.requiredEpiCount === 1 ? '' : 's'}
                              </p>
                            </div>
                            <button
                              type="button"
                              className={`btn ${selected ? 'btn-primary' : 'btn-secondary'} portal-pick-card__action`}
                              onClick={() => void selectWorker(worker)}
                            >
                              {selected ? 'Selecionado' : 'Selecionar'}
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>

                {selectedId ? (
                  <div className="btn-row" style={{ marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setWorkerPickerOpen(false)}
                    >
                      Manter selecao e ir aos EPIs
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section
            ref={coverageSectionRef}
            className="portal-card"
            aria-labelledby="coverage-title"
          >
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

                {coverage && coverage.biometricConsentStatus !== 'GRANTED' ? (
                  <div className="notice notice--warn" role="alert">
                    <p>
                      Trabalhador sem consentimento biometrico ativo. Solicite
                      regularizacao a Consultoria.
                    </p>
                  </div>
                ) : null}

                {coverage &&
                coverage.biometricConsentStatus === 'GRANTED' &&
                !coverage.workerHasBiometricTemplate ? (
                  <div className="notice notice--warn" role="alert">
                    <p>
                      {coverage.facialReference.needsReenrollment
                        ? 'Biometria do trabalhador precisa ser recadastrada.'
                        : 'Este trabalhador ainda nao possui biometria facial cadastrada.'}
                    </p>
                    <p className="table-sub">
                      Solicite a Consultoria o cadastro ou recadastro antes de
                      continuar.
                    </p>
                  </div>
                ) : null}

                {coverage.needs.length === 0 ? (
                  <p className="page-lead">
                    Nenhuma indicacao normativa para este trabalhador. Voce pode
                    registrar entrega extra por CA/estoque abaixo.
                  </p>
                ) : null}
                {epiPhase === 'pick' ? (
                  <>
                    <p className="page-lead" style={{ marginBottom: '0.75rem' }}>
                      Marque os EPIs desta entrega. Os riscos ajudam a
                      identificar o item certo.
                    </p>
                    <div className="portal-epi-pick-list" role="group">
                      {coverage.needs.map((need) => (
                        <NeedPickRow
                          key={need.requirementId}
                          row={need}
                          selection={
                            selections[need.epiNeedId] ??
                            defaultSelection(need)
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
                    <div className="field" style={{ marginTop: '1rem' }}>
                      <label htmlFor="entrega-extra-search">
                        Adicionar EPI fora das indicacoes (CA/estoque)
                      </label>
                      <input
                        id="entrega-extra-search"
                        value={extraQuery}
                        onChange={(e) => setExtraQuery(e.target.value)}
                        placeholder="Buscar por nome, CA ou local"
                        autoComplete="off"
                      />
                      <p className="field-hint">
                        Entrega complementar sem alterar as indicacoes da funcao.
                      </p>
                    </div>
                    {availableExtraBalances.length > 0 ? (
                      <div className="portal-pick-list" role="list">
                        {availableExtraBalances.map((row) => (
                          <article
                            key={`${row.epiItemId}:${row.stockLocationId}`}
                            role="listitem"
                            className="portal-pick-card"
                          >
                            <div className="portal-pick-card__body">
                              <div className="portal-pick-card__main">
                                <strong className="portal-pick-card__title">
                                  {row.epiName}
                                </strong>
                                <p className="portal-pick-card__meta">
                                  {row.caNumber ? `CA ${row.caNumber}` : 'CA n/a'}
                                  {' · '}
                                  {row.locationName}
                                  {' · '}
                                  Saldo {row.quantity}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="btn btn-secondary portal-pick-card__action"
                                onClick={() => addExtraFromBalance(row)}
                              >
                                Adicionar extra
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                    {extraItems.length > 0 ? (
                      <div className="portal-epi-pick-list" role="group">
                        {extraItems.map((item) => (
                          <article key={item.key} className="portal-epi-pick is-selected">
                            <div className="portal-epi-pick__body">
                              <div className="portal-epi-pick__top">
                                <strong>
                                  Extra: {item.epiName}
                                  {item.caNumber ? ` (CA ${item.caNumber})` : ''}
                                </strong>
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  onClick={() =>
                                    setExtraItems((prev) =>
                                      prev.filter((row) => row.key !== item.key),
                                    )
                                  }
                                >
                                  Remover
                                </button>
                              </div>
                              <p className="table-sub">
                                {item.locationName} · saldo {item.availableQuantity}
                              </p>
                              <div className="form-grid form-grid--compact">
                                <div className="field">
                                  <label>Quantidade</label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={item.availableQuantity}
                                    value={item.quantity}
                                    onChange={(e) =>
                                      setExtraItems((prev) =>
                                        prev.map((row) =>
                                          row.key !== item.key
                                            ? row
                                            : {
                                                ...row,
                                                quantity: Math.max(
                                                  1,
                                                  Math.min(
                                                    row.availableQuantity,
                                                    Number(e.target.value) || 1,
                                                  ),
                                                ),
                                              },
                                        ),
                                      )
                                    }
                                  />
                                </div>
                                <div className="field">
                                  <label>Vida util (dias corridos)</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.usefulLifeValue}
                                    onChange={(e) =>
                                      setExtraItems((prev) =>
                                        prev.map((row) =>
                                          row.key !== item.key
                                            ? row
                                            : {
                                                ...row,
                                                usefulLifeValue: e.target.value,
                                                usefulLifeUnit: 'DIAS',
                                              },
                                        ),
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                    <div className="field" style={{ marginTop: '1rem' }}>
                      <label htmlFor="entrega-notes">
                        Observacoes (opcional)
                      </label>
                      <textarea
                        id="entrega-notes"
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        maxLength={2000}
                      />
                    </div>
                    {coverage.biometricConsentStatus === 'GRANTED' &&
                    coverage.workerHasBiometricTemplate &&
                    (coverage.needs.some((n) => n.status === 'DISPONIVEL') ||
                      extraItems.length > 0) ? (
                      <div className="flow-sticky-bar portal-sticky-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={totalPickedCount === 0}
                          onClick={() => {
                            if (selectedItems.length === 0) {
                              void openFaceFlow();
                              return;
                            }
                            setEpiConfigIndex(0);
                            setEpiPhase('configure');
                          }}
                        >
                          Continuar ({totalPickedCount} EPI
                          {totalPickedCount === 1 ? '' : 's'})
                        </button>
                        <Link
                          className="btn btn-secondary"
                          href="/portal/estoque"
                        >
                          Ir ao estoque
                        </Link>
                      </div>
                    ) : null}
                  </>
                ) : configRow ? (
                  <>
                    <NeedConfigPanel
                      row={configRow.need}
                      selection={configRow.sel}
                      index={epiConfigIndex}
                      total={selectedItems.length}
                      onChange={(next) =>
                        setSelections((prev) => ({
                          ...prev,
                          [configRow.need.epiNeedId]: next,
                        }))
                      }
                    />
                    <div className="flow-sticky-bar portal-sticky-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          if (epiConfigIndex <= 0) {
                            setEpiPhase('pick');
                            return;
                          }
                          setEpiConfigIndex((i) => i - 1);
                        }}
                      >
                        {epiConfigIndex <= 0 ? 'Voltar a lista' : 'Anterior'}
                      </button>
                      {epiConfigIndex < selectedItems.length - 1 ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={
                            !configRow.sel.epiItemId ||
                            !configRow.sel.stockLocationId ||
                            !configRow.sel.usefulLifeValue.trim()
                          }
                          onClick={() => setEpiConfigIndex((i) => i + 1)}
                        >
                          Proximo EPI
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={!canProceedToFace}
                          onClick={openFaceFlow}
                        >
                          Validar face e entregar
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="page-lead">
                    Nenhum EPI selecionado.{' '}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setEpiPhase('pick')}
                    >
                      Voltar a lista
                    </button>
                  </p>
                )}
              </>
            ) : null}
          </section>
        </>
      ) : null}

      {faceFlowOpen &&
      coverage &&
      typeof document !== 'undefined'
        ? createPortal(
            <div
              className="delivery-face-flow"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delivery-face-title"
            >
              <div className="delivery-face-flow__sheet">
                <header className="delivery-face-flow__header">
                  <div>
                    <p className="page-kicker">Entrega</p>
                    <h2
                      id="delivery-face-title"
                      className="page-title page-title--sm"
                    >
                      {faceFlowStep === 'scan'
                        ? 'Validacao facial'
                        : 'Confirmar entrega'}
                    </h2>
                    <p className="table-sub">
                      {coverage.worker.name}
                      {totalPickedCount > 0
                        ? ` · ${totalPickedCount} EPI${
                            totalPickedCount === 1 ? '' : 's'
                          }`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={closeFaceFlow}
                    disabled={submitting}
                  >
                    Fechar
                  </button>
                </header>

                {error ? (
                  <p className="error" role="alert">
                    {error}
                  </p>
                ) : null}

                {faceFlowStep === 'scan' ? (
                  <div className="delivery-face-flow__body">
                    <FacialValidationPanel
                      key={`face-scan-${coverage.worker.id}-${faceScanKey}`}
                      workerId={coverage.worker.id}
                      hasBiometricTemplate={
                        coverage.workerHasBiometricTemplate
                      }
                      needsReenrollment={
                        coverage.facialReference.needsReenrollment
                      }
                      disabled={submitting}
                      autoStart
                      compact
                      onMatched={onFaceMatched}
                      onReset={resetFacial}
                    />
                  </div>
                ) : (
                  <div className="delivery-face-flow__confirm">
                    <div className="delivery-face-flow__preview">
                      {facePreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={facePreviewUrl}
                          alt="Face validada"
                          className="delivery-face-flow__thumb"
                        />
                      ) : (
                        <div className="delivery-face-flow__thumb delivery-face-flow__thumb--empty">
                          Face validada
                        </div>
                      )}
                      <p className="notice notice--ok" role="status">
                        Biometria validada. Confirme para registrar a entrega.
                      </p>
                    </div>

                    <ul
                      className="delivery-face-flow__items"
                      aria-label="EPIs"
                    >
                      {selectedItems.map(({ need, sel }) => (
                        <li key={need.epiNeedId}>
                          <strong>{need.needName}</strong>
                          <span className="table-sub">Qtd {sel.quantity}</span>
                        </li>
                      ))}
                      {extraItems.map((item) => (
                        <li key={item.key}>
                          <strong>
                            Extra: {item.epiName}
                            {item.caNumber ? ` (CA ${item.caNumber})` : ''}
                          </strong>
                          <span className="table-sub">Qtd {item.quantity}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="delivery-face-flow__actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!canSubmit}
                        onClick={() => void submitDelivery()}
                      >
                        {submitting ? 'Registrando...' : 'Entregar'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={submitting}
                        onClick={() => {
                          resetFacial();
                          setFaceScanKey((k) => k + 1);
                          setFaceFlowStep('scan');
                        }}
                      >
                        Refazer biometria
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}

      <section
        className="portal-card"
        aria-labelledby="history-title"
        style={{ marginTop: '1.25rem' }}
      >
        <h2 id="history-title" className="page-title page-title--sm">
          Historico recente
        </h2>
        <div className="field" style={{ maxWidth: 260, marginBottom: '0.75rem' }}>
          <label htmlFor="history-status">Filtrar status</label>
          <select
            id="history-status"
            value={historyStatus}
            onChange={(e) => setHistoryStatus(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="COMPLETED">Concluida</option>
            <option value="CANCELLED">Cancelada</option>
            <option value="PARTIALLY_RETURNED">Parcialmente devolvida</option>
            <option value="RETURNED">Devolvida</option>
          </select>
        </div>
        {history.length === 0 ? (
          <p className="page-lead">Nenhuma entrega registrada ainda.</p>
        ) : (
          <div className="portal-pick-list" role="list" aria-label="Historico de entregas">
            {history.map((row) => (
              <article key={row.id} role="listitem" className="portal-pick-card">
                <div className="portal-pick-card__body">
                  <div className="portal-pick-card__main">
                    <strong className="portal-pick-card__title">
                      {row.worker.name}
                    </strong>
                    <p className="portal-pick-card__meta mono">
                      {row.receiptNumber} · {row.statusLabel}
                    </p>
                    <p className="portal-pick-card__meta">
                      {formatDateTime(row.deliveredAt)}
                      {' · '}
                      {row.deliveredBy.name}
                    </p>
                    <p className="portal-pick-card__meta">
                      {row.items
                        .map((item) => `${item.needName} (${item.quantity})`)
                        .join(', ')}
                    </p>
                  </div>
                  <Link
                    className="btn btn-secondary portal-pick-card__action"
                    href={`/portal/entregas/${row.id}`}
                  >
                    Ver
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function PortalEntregasPage() {
  return (
    <RequireClientAuth>
      {() => (
        <Suspense fallback={<p className="page-lead">Carregando...</p>}>
          <PortalEntregasContent />
        </Suspense>
      )}
    </RequireClientAuth>
  );
}
