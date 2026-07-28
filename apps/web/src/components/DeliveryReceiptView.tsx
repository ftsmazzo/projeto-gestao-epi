'use client';

import type {
  PortalDeliveryDetail,
  PortalDeliveryReturnCondition,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  cancelPortalDelivery,
  createPortalDeliveryReturn,
} from '../lib/client-auth';
import { formatCnpj } from '../lib/cnpj';
import { PortalFacialEvidenceThumb } from './PortalFacialEvidenceThumb';

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

const CONDITION_OPTIONS: Array<{
  value: PortalDeliveryReturnCondition;
  label: string;
  stockHint: string;
}> = [
  {
    value: 'REUSABLE',
    label: 'Reutilizavel',
    stockHint: 'Volta ao estoque',
  },
  {
    value: 'DAMAGED',
    label: 'Danificado',
    stockHint: 'Nao volta ao estoque',
  },
  {
    value: 'DISCARDED',
    label: 'Descartado',
    stockHint: 'Nao volta ao estoque',
  },
  {
    value: 'LOST',
    label: 'Perdido',
    stockHint: 'Nao volta ao estoque',
  },
];

type ReturnRowState = {
  selected: boolean;
  quantity: number;
  condition: PortalDeliveryReturnCondition;
};

export function DeliveryReceiptView({
  detail,
  showActions = true,
  onUpdated,
}: {
  detail: PortalDeliveryDetail;
  showActions?: boolean;
  onUpdated?: (next: PortalDeliveryDetail) => void;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [returnRows, setReturnRows] = useState<Record<string, ReturnRowState>>(
    {},
  );

  const returnableItems = useMemo(
    () => detail.items.filter((item) => item.availableQuantity > 0),
    [detail.items],
  );

  function openReturnModal() {
    const next: Record<string, ReturnRowState> = {};
    for (const item of returnableItems) {
      next[item.id] = {
        selected: returnableItems.length === 1,
        quantity: Math.min(1, item.availableQuantity),
        condition: 'REUSABLE',
      };
    }
    setReturnRows(next);
    setReturnReason('');
    setReturnNotes('');
    setActionError(null);
    setReturnOpen(true);
  }

  async function submitCancel() {
    if (cancelReason.trim().length < 3) {
      setActionError('Informe o motivo do cancelamento.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const next = await cancelPortalDelivery(detail.id, cancelReason.trim());
      setCancelOpen(false);
      setCancelReason('');
      onUpdated?.(next);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Falha ao cancelar a entrega.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitReturn() {
    const items = Object.entries(returnRows)
      .filter(([, row]) => row.selected)
      .map(([deliveryItemId, row]) => ({
        deliveryItemId,
        quantity: row.quantity,
        condition: row.condition,
      }));
    if (items.length === 0) {
      setActionError('Selecione ao menos um item para devolver.');
      return;
    }
    if (returnReason.trim().length < 3) {
      setActionError('Informe o motivo da devolucao.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const next = await createPortalDeliveryReturn(detail.id, {
        reason: returnReason.trim(),
        notes: returnNotes.trim() || null,
        items,
      });
      setReturnOpen(false);
      onUpdated?.(next);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Falha ao registrar devolucao.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="epi-doc-wrap">
      {actionError ? (
        <p className="error no-print" role="alert">
          {actionError}
        </p>
      ) : null}

      {showActions ? (
        <div className="btn-row no-print epi-doc-toolbar">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
          >
            Imprimir / salvar PDF
          </button>
          {detail.actions.canCancel ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setCancelOpen(true);
                setActionError(null);
              }}
            >
              Cancelar entrega
            </button>
          ) : null}
          {detail.actions.canReturn ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openReturnModal}
            >
              Registrar devolucao
            </button>
          ) : null}
          <Link className="btn btn-secondary" href="/portal/entregas">
            Voltar
          </Link>
        </div>
      ) : null}

      <article className="epi-doc" aria-labelledby="receipt-heading">
        <header className="epi-doc__masthead">
          <div className="epi-doc__brand">
            <p className="epi-doc__doc-type">Comprovante de entrega de EPI</p>
            <h1 id="receipt-heading" className="epi-doc__title">
              {detail.client.legalName}
            </h1>
            <p className="epi-doc__meta">
              CNPJ {formatCnpj(detail.client.cnpj)}
              {detail.client.tradeName ? ` · ${detail.client.tradeName}` : ''}
            </p>
          </div>
          <div className="epi-doc__receipt-box">
            <p className="epi-doc__receipt-label">Nº do comprovante</p>
            <p className="epi-doc__receipt-number mono">{detail.receiptNumber}</p>
            <p className="epi-doc__meta">
              {formatDateTime(detail.deliveredAt)}
            </p>
            <p className="epi-doc__status">{detail.statusLabel}</p>
          </div>
        </header>

        <section className="epi-doc__section">
          <h2 className="epi-doc__section-title">Trabalhador</h2>
          <div className="epi-doc__grid">
            <div>
              <span className="epi-doc__label">Nome</span>
              <strong>{detail.worker.name}</strong>
            </div>
            <div>
              <span className="epi-doc__label">Matricula</span>
              <span>{detail.worker.registration ?? '—'}</span>
            </div>
            <div>
              <span className="epi-doc__label">CPF</span>
              <span className="mono">{detail.worker.cpfMasked ?? '—'}</span>
            </div>
            <div>
              <span className="epi-doc__label">Unidade</span>
              <span>{detail.worker.unitName ?? '—'}</span>
            </div>
            <div>
              <span className="epi-doc__label">Setor</span>
              <span>{detail.worker.sectorName ?? '—'}</span>
            </div>
            <div>
              <span className="epi-doc__label">Funcao</span>
              <span>{detail.worker.jobFunctionName ?? '—'}</span>
            </div>
          </div>
        </section>

        <section className="epi-doc__section">
          <h2 className="epi-doc__section-title">Itens entregues</h2>
          <table className="epi-doc__table">
            <thead>
              <tr>
                <th>EPI / necessidade</th>
                <th>CA</th>
                <th>Qtd</th>
                <th>Vida util</th>
                <th>Frequencia</th>
                <th>Prox. troca</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.epiName}</strong>
                    <span className="epi-doc__sub">{item.needName}</span>
                    {item.variantName ? (
                      <span className="epi-doc__sub">{item.variantName}</span>
                    ) : null}
                  </td>
                  <td className="mono">{item.caNumber ?? '—'}</td>
                  <td className="mono">{item.quantity}</td>
                  <td>{item.usefulLifeLabel ?? '—'}</td>
                  <td>{item.usageFrequencyLabel ?? 'Uso diario'}</td>
                  <td>
                    {item.nextReplacementAt
                      ? formatDate(item.nextReplacementAt)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {detail.notes ? (
            <p className="epi-doc__notes">
              <span className="epi-doc__label">Observacoes</span>
              {detail.notes}
            </p>
          ) : null}
        </section>

        {detail.cancellation ? (
          <section className="epi-doc__section epi-doc__section--warn">
            <h2 className="epi-doc__section-title">Cancelamento</h2>
            <p className="epi-doc__meta">
              {formatDateTime(detail.cancellation.cancelledAt)} ·{' '}
              {detail.cancellation.cancelledBy?.name ?? '—'}
            </p>
            <p>{detail.cancellation.reason ?? '—'}</p>
          </section>
        ) : null}

        {detail.returns.length > 0 ? (
          <section className="epi-doc__section">
            <h2 className="epi-doc__section-title">Devolucoes</h2>
            <ul className="epi-doc__list">
              {detail.returns.map((ret) => (
                <li key={ret.id}>
                  <strong>{formatDateTime(ret.returnedAt)}</strong> —{' '}
                  {ret.returnedBy.name}: {ret.reason}
                  <span className="epi-doc__sub">
                    {ret.items
                      .map(
                        (ri) =>
                          `${ri.epiName}: ${ri.quantity} (${ri.condition})`,
                      )
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="epi-doc__section epi-doc__section--split">
          <div>
            <h2 className="epi-doc__section-title">Identificacao facial</h2>
            {detail.evidence?.verificationStatus === 'MATCHED' ? (
              <p className="epi-doc__ok">Aprovada automaticamente</p>
            ) : detail.evidence ? (
              <p>{detail.evidence.statusLabel}</p>
            ) : (
              <p className="epi-doc__meta">Sem evidencia facial</p>
            )}
            {detail.evidence ? (
              <PortalFacialEvidenceThumb
                deliveryId={detail.id}
                hasFile={detail.evidence.hasFile}
                fileRemovedByRetention={detail.evidence.fileRemovedByRetention}
                capturedAtLabel={formatDateTime(detail.evidence.capturedAt)}
              />
            ) : null}
          </div>
          <div>
            <h2 className="epi-doc__section-title">Termo de responsabilidade</h2>
            <p className="epi-doc__term">{detail.declaration.text}</p>
            <p className="epi-doc__meta">
              Versao {detail.declaration.version}
              {detail.consent.acceptedAt
                ? ` · Aceite em ${formatDateTime(detail.consent.acceptedAt)}`
                : ''}
            </p>
          </div>
        </section>

        <footer className="epi-doc__footer">
          <div>
            <span className="epi-doc__label">Operador</span>
            <strong>{detail.deliveredBy.name}</strong>
            <span className="epi-doc__sub">{detail.deliveredBy.email}</span>
          </div>
          <p className="epi-doc__lgpd">
            Evidencia facial e dado sensivel (LGPD). Documento para auditoria
            autenticada do fornecimento de EPI (NR-06).
          </p>
        </footer>
      </article>

      {cancelOpen ? (
        <div className="portal-modal no-print" role="dialog" aria-modal="true">
          <div className="portal-modal__panel">
            <h2 className="page-title page-title--sm">Cancelar entrega</h2>
            <p className="notice notice--warn" role="status">
              O estoque dos itens ainda validos sera revertido. A evidencia
              facial e o comprovante permanecem no historico.
            </p>
            <div className="field">
              <label htmlFor="cancel-reason">Motivo (obrigatorio)</label>
              <textarea
                id="cancel-reason"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                maxLength={1000}
              />
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void submitCancel()}
              >
                {busy ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setCancelOpen(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {returnOpen ? (
        <div className="portal-modal no-print" role="dialog" aria-modal="true">
          <div className="portal-modal__panel portal-modal__panel--wide">
            <h2 className="page-title page-title--sm">Registrar devolucao</h2>
            {returnableItems.length === 0 ? (
              <p className="page-lead">Nao ha quantidades disponiveis.</p>
            ) : (
              <div className="portal-coverage-list">
                {returnableItems.map((item) => {
                  const row = returnRows[item.id];
                  if (!row) return null;
                  const cond = CONDITION_OPTIONS.find(
                    (c) => c.value === row.condition,
                  );
                  return (
                    <article key={item.id} className="portal-coverage-need">
                      <label className="portal-need-select">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(e) =>
                            setReturnRows((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...row,
                                selected: e.target.checked,
                              },
                            }))
                          }
                        />
                        <strong>
                          {item.needName} → {item.epiName}
                        </strong>
                      </label>
                      <p className="table-sub">
                        Disponivel: {item.availableQuantity} · Local:{' '}
                        {item.locationName}
                      </p>
                      {row.selected ? (
                        <div className="form-grid form-grid--compact">
                          <div className="field">
                            <label>Quantidade</label>
                            <input
                              type="number"
                              min={1}
                              max={item.availableQuantity}
                              value={row.quantity}
                              onChange={(e) =>
                                setReturnRows((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...row,
                                    quantity: Math.max(
                                      1,
                                      Math.min(
                                        item.availableQuantity,
                                        Number(e.target.value) || 1,
                                      ),
                                    ),
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="field">
                            <label>Condicao</label>
                            <select
                              value={row.condition}
                              onChange={(e) =>
                                setReturnRows((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...row,
                                    condition: e.target
                                      .value as PortalDeliveryReturnCondition,
                                  },
                                }))
                              }
                            >
                              {CONDITION_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <p className="field-hint">{cond?.stockHint}</p>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
            <div className="field" style={{ marginTop: '0.75rem' }}>
              <label htmlFor="return-reason">Motivo (obrigatorio)</label>
              <textarea
                id="return-reason"
                rows={2}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                maxLength={1000}
              />
            </div>
            <div className="field">
              <label htmlFor="return-notes">Observacoes</label>
              <textarea
                id="return-notes"
                rows={2}
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                maxLength={2000}
              />
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || returnableItems.length === 0}
                onClick={() => void submitReturn()}
              >
                {busy ? 'Registrando...' : 'Confirmar devolucao'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setReturnOpen(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
