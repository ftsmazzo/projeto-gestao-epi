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
    <article className="portal-receipt" aria-labelledby="receipt-heading">
      <header className="portal-receipt__header">
        <p className="page-kicker">Painel do Cliente</p>
        <h1 id="receipt-heading" className="page-title page-title--sm">
          Comprovante de entrega de EPI
        </h1>
        <p className="portal-receipt__code mono">{detail.receiptNumber}</p>
        <p className="table-sub">
          Emitido em {formatDateTime(detail.deliveredAt)} ·{' '}
          <span className="status-pill status-pill--active">
            {detail.statusLabel}
          </span>
        </p>
      </header>

      <section className="portal-receipt__block">
        <h2 className="page-title page-title--sm">Empresa</h2>
        <dl className="portal-receipt__dl">
          <div>
            <dt>Razao social</dt>
            <dd>{detail.client.legalName}</dd>
          </div>
          {detail.client.tradeName ? (
            <div>
              <dt>Nome fantasia</dt>
              <dd>{detail.client.tradeName}</dd>
            </div>
          ) : null}
          <div>
            <dt>CNPJ</dt>
            <dd className="mono">{formatCnpj(detail.client.cnpj)}</dd>
          </div>
        </dl>
      </section>

      {actionError ? (
        <p className="error no-print" role="alert">
          {actionError}
        </p>
      ) : null}

      {showActions && (detail.actions.canCancel || detail.actions.canReturn) ? (
        <div className="btn-row no-print" style={{ marginBottom: '1rem' }}>
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
        </div>
      ) : null}

      <section className="portal-receipt__block">
        <h2 className="page-title page-title--sm">Trabalhador</h2>
        <dl className="portal-receipt__dl">
          <div>
            <dt>Nome</dt>
            <dd>{detail.worker.name}</dd>
          </div>
          <div>
            <dt>Matricula</dt>
            <dd>{detail.worker.registration ?? '—'}</dd>
          </div>
          <div>
            <dt>CPF</dt>
            <dd className="mono">{detail.worker.cpfMasked ?? '—'}</dd>
          </div>
          <div>
            <dt>Unidade</dt>
            <dd>{detail.worker.unitName ?? '—'}</dd>
          </div>
          <div>
            <dt>Setor</dt>
            <dd>{detail.worker.sectorName ?? '—'}</dd>
          </div>
          <div>
            <dt>Funcao</dt>
            <dd>{detail.worker.jobFunctionName ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="portal-receipt__block">
        <h2 className="page-title page-title--sm">Entrega</h2>
        <dl className="portal-receipt__dl">
          <div>
            <dt>Operador</dt>
            <dd>
              {detail.deliveredBy.name}
              <span className="table-sub">{detail.deliveredBy.email}</span>
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{detail.statusLabel}</dd>
          </div>
          {detail.notes ? (
            <div>
              <dt>Observacoes</dt>
              <dd>{detail.notes}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {detail.cancellation ? (
        <section className="portal-receipt__block">
          <h2 className="page-title page-title--sm">Cancelamento</h2>
          <dl className="portal-receipt__dl">
            <div>
              <dt>Quando</dt>
              <dd>{formatDateTime(detail.cancellation.cancelledAt)}</dd>
            </div>
            <div>
              <dt>Por</dt>
              <dd>{detail.cancellation.cancelledBy?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd>{detail.cancellation.reason ?? '—'}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="portal-receipt__block">
        <h2 className="page-title page-title--sm">Itens entregues</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Necessidade</th>
                <th>EPI real</th>
                <th>CA</th>
                <th>Qtd</th>
                <th>Dev.</th>
                <th>Canc.</th>
                <th>Disp.</th>
                <th>Status</th>
                <th>Local</th>
                <th>Prox. troca</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.needName}</td>
                  <td>{item.epiName}</td>
                  <td className="mono">{item.caNumber ?? '—'}</td>
                  <td className="mono">{item.quantity}</td>
                  <td className="mono">{item.returnedQuantity}</td>
                  <td className="mono">{item.cancelledQuantity}</td>
                  <td className="mono">{item.availableQuantity}</td>
                  <td>{item.statusLabel}</td>
                  <td>{item.locationName}</td>
                  <td>
                    {item.nextReplacementAt
                      ? formatDate(item.nextReplacementAt)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {detail.returns.length > 0 ? (
        <section className="portal-receipt__block">
          <h2 className="page-title page-title--sm">Historico de devolucoes</h2>
          <ul className="portal-coverage-epis">
            {detail.returns.map((ret) => (
              <li key={ret.id}>
                <strong>{formatDateTime(ret.returnedAt)}</strong>
                <span className="table-sub">
                  {ret.returnedBy.name} · {ret.reason}
                </span>
                <span className="table-sub">
                  {ret.items
                    .map(
                      (ri) =>
                        `${ri.needName}/${ri.epiName}: ${ri.quantity} (${ri.condition}${
                          ri.returnsToStock ? ', estoque+' : ''
                        })`,
                    )
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="portal-receipt__block">
        <h2 className="page-title page-title--sm">Evidencia facial</h2>
        {detail.evidence?.verificationStatus === 'MATCHED' ? (
          <p className="portal-receipt__biometric" role="status">
            Biometria facial: aprovada automaticamente
            {detail.consent.biometric.status === 'GRANTED'
              ? ' · consentimento biometrico ativo no ato'
              : ''}
          </p>
        ) : null}
        {detail.evidence ? (
          <>
            {detail.evidence.verificationStatus !== 'MATCHED' ? (
              <p className="portal-receipt__biometric" role="status">
                {detail.evidence.verificationStatus === 'REJECTED'
                  ? 'Biometria facial: nao correspondente'
                  : detail.evidence.statusLabel}
              </p>
            ) : null}
            <dl className="portal-receipt__dl">
              <div>
                <dt>Capturada em</dt>
                <dd>{formatDateTime(detail.evidence.capturedAt)}</dd>
              </div>
            </dl>
            <PortalFacialEvidenceThumb
              deliveryId={detail.id}
              hasFile={detail.evidence.hasFile}
              fileRemovedByRetention={detail.evidence.fileRemovedByRetention}
              capturedAtLabel={formatDateTime(detail.evidence.capturedAt)}
            />
          </>
        ) : (
          <p className="field-hint">Sem evidencia facial registrada.</p>
        )}
      </section>

      <section className="portal-receipt__block">
        <h2 className="page-title page-title--sm">
          Declaracao / termo de responsabilidade
        </h2>
        <p className="portal-receipt__consent">{detail.declaration.text}</p>
        <p className="table-sub">
          Versao {detail.declaration.version}
          {detail.consent.acceptedAt
            ? ` · Registro operacional em ${formatDateTime(detail.consent.acceptedAt)}`
            : ''}
        </p>
      </section>

      <section className="portal-receipt__block">
        <h2 className="page-title page-title--sm">Aviso / consentimento</h2>
        {detail.consent.accepted ? (
          <>
            <p className="portal-receipt__consent">
              {detail.consent.text ??
                'Aviso de evidencia facial aceito no ato da entrega.'}
            </p>
            <p className="table-sub">
              Aceito em{' '}
              {detail.consent.acceptedAt
                ? formatDateTime(detail.consent.acceptedAt)
                : '—'}
              {detail.consent.version
                ? ` · Versao ${detail.consent.version}`
                : ''}
            </p>
          </>
        ) : (
          <p className="field-hint">
            Consentimento nao registrado nesta entrega.
          </p>
        )}
        <p className="table-sub portal-receipt__lgpd">
          A imagem facial e dado sensivel (LGPD). Este comprovante e destinado a
          uso autenticado e auditoria de fornecimento de EPI.
        </p>
      </section>

      {showActions ? (
        <div className="btn-row portal-receipt__actions no-print">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
          >
            Imprimir comprovante
          </button>
          <Link className="btn btn-secondary" href="/portal/entregas">
            Voltar as entregas
          </Link>
        </div>
      ) : null}

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
    </article>
  );
}
