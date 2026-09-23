'use client';

import type { PortalWorkerEpiSheetResponse } from '@gestao-epi/shared';
import Link from 'next/link';
import { useState } from 'react';
import { downloadPortalWorkerEpiSheetPdf } from '../lib/client-auth';
import { formatCnpj } from '../lib/cnpj';
import { EpiLegalDeclarationBlock } from './EpiLegalDeclarationBlock';
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

function formatPeriodLabel(from: string | null, to: string | null) {
  if (!from && !to) return 'Todo o historico';
  if (from && to) {
    return `${formatDate(`${from}T00:00:00.000Z`)} a ${formatDate(`${to}T00:00:00.000Z`)}`;
  }
  if (from) return `A partir de ${formatDate(`${from}T00:00:00.000Z`)}`;
  return `Ate ${formatDate(`${to!}T00:00:00.000Z`)}`;
}

export function WorkerEpiSheetView({
  data,
  scope,
  onScopeChange,
  periodFrom = '',
  periodTo = '',
  onPeriodFromChange,
  onPeriodToChange,
  onApplyPeriod,
  onClearPeriod,
  periodLoading = false,
  headerMode = 'company',
  onHeaderModeChange,
  includeWorkHistory = false,
  onIncludeWorkHistoryChange,
}: {
  data: PortalWorkerEpiSheetResponse;
  scope: 'history' | 'open';
  onScopeChange?: (scope: 'history' | 'open') => void;
  periodFrom?: string;
  periodTo?: string;
  onPeriodFromChange?: (value: string) => void;
  onPeriodToChange?: (value: string) => void;
  onApplyPeriod?: () => void;
  onClearPeriod?: () => void;
  periodLoading?: boolean;
  headerMode?: 'company' | 'worksite';
  onHeaderModeChange?: (mode: 'company' | 'worksite') => void;
  includeWorkHistory?: boolean;
  onIncludeWorkHistoryChange?: (value: boolean) => void;
}) {
  const hasPeriodFilter = Boolean(data.period?.from || data.period?.to);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const works = data.works;
  const useWorksiteHeader =
    works?.enabled && headerMode === 'worksite' && works.primary;
  const mastheadTitle = useWorksiteHeader
    ? works.primary!.name
    : data.client.legalName;
  const mastheadCnpj = useWorksiteHeader
    ? works.primary!.cnpj
    : data.client.cnpj;
  const mastheadExtra = useWorksiteHeader
    ? data.client.legalName
    : data.client.tradeName;

  async function downloadPdf() {
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadPortalWorkerEpiSheetPdf(data.worker.id, scope, {
        from: periodFrom || data.period.from || undefined,
        to: periodTo || data.period.to || undefined,
      }, works?.enabled
        ? { headerMode, includeWorkHistory }
        : undefined);
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : 'Falha ao baixar o PDF.',
      );
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="epi-doc-wrap">
      {pdfError ? (
        <p className="error no-print" role="alert">
          {pdfError}
        </p>
      ) : null}
      <div className="btn-row no-print epi-doc-toolbar">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.print()}
        >
          Imprimir
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void downloadPdf()}
          disabled={pdfBusy || periodLoading}
        >
          {pdfBusy ? 'Gerando PDF…' : 'Baixar PDF'}
        </button>
        <Link className="btn btn-secondary" href="/portal/trabalhadores">
          Voltar aos trabalhadores
        </Link>
        {onScopeChange ? (
          <label className="portal-epi-sheet__scope">
            <span className="field-hint">Status</span>
            <select
              value={scope}
              onChange={(e) =>
                onScopeChange(e.target.value === 'open' ? 'open' : 'history')
              }
            >
              <option value="history">Historico (exceto canceladas)</option>
              <option value="open">Apenas concluidas / parcial</option>
            </select>
          </label>
        ) : null}
      </div>

      {onApplyPeriod ? (
        <div className="btn-row no-print portal-epi-sheet__period">
          <label className="portal-epi-sheet__scope">
            <span className="field-hint">De</span>
            <input
              type="date"
              value={periodFrom}
              onChange={(e) => onPeriodFromChange?.(e.target.value)}
            />
          </label>
          <label className="portal-epi-sheet__scope">
            <span className="field-hint">Ate</span>
            <input
              type="date"
              value={periodTo}
              onChange={(e) => onPeriodToChange?.(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onApplyPeriod}
            disabled={periodLoading}
          >
            Filtrar periodo
          </button>
          {hasPeriodFilter || periodFrom || periodTo ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClearPeriod}
              disabled={periodLoading}
            >
              Limpar datas
            </button>
          ) : null}
        </div>
      ) : null}

      {works?.enabled && onHeaderModeChange ? (
        <div className="btn-row no-print portal-epi-sheet__period">
          <label className="portal-epi-sheet__scope">
            <span className="field-hint">Cabecalho</span>
            <select
              value={headerMode}
              onChange={(e) =>
                onHeaderModeChange(
                  e.target.value === 'worksite' ? 'worksite' : 'company',
                )
              }
            >
              <option value="company">Empresa + obra adicional</option>
              <option value="worksite">Obra como cabecalho</option>
            </select>
          </label>
          {works.hasMultipleInPeriod && onIncludeWorkHistoryChange ? (
            <label className="portal-epi-sheet__scope">
              <span className="field-hint">Historico de obras</span>
              <select
                value={includeWorkHistory ? 'yes' : 'no'}
                onChange={(e) =>
                  onIncludeWorkHistoryChange(e.target.value === 'yes')
                }
              >
                <option value="no">So a ultima obra do periodo</option>
                <option value="yes">Incluir historico no periodo</option>
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {works?.enabled && works.hasMultipleInPeriod && !includeWorkHistory ? (
        <p className="notice notice--info no-print" role="status">
          Trabalhador com historico de outras obras no periodo. Inclua o
          historico se quiser listar todas abaixo do cabecalho.
        </p>
      ) : null}

      <article className="epi-doc" aria-labelledby="epi-sheet-heading">
        <header className="epi-doc__masthead">
          <div className="epi-doc__brand">
            <p className="epi-doc__doc-type">Ficha de controle de EPI</p>
            <h1 id="epi-sheet-heading" className="epi-doc__title">
              {mastheadTitle}
            </h1>
            <p className="epi-doc__meta">
              {mastheadCnpj
                ? `CNPJ ${formatCnpj(mastheadCnpj)}`
                : 'CNPJ nao informado'}
              {mastheadExtra ? ` · ${mastheadExtra}` : ''}
            </p>
            {works?.enabled &&
            headerMode === 'company' &&
            works.primary ? (
              <p className="epi-doc__meta">
                Obra: {works.primary.name}
                {works.primary.cnpj
                  ? ` · CNPJ ${formatCnpj(works.primary.cnpj)}`
                  : ''}
              </p>
            ) : null}
            {works?.enabled && headerMode === 'worksite' ? (
              <p className="epi-doc__meta">
                Empresa: {data.client.legalName} · CNPJ{' '}
                {formatCnpj(data.client.cnpj)}
              </p>
            ) : null}
          </div>
          <div className="epi-doc__receipt-box">
            <p className="epi-doc__receipt-label">Trabalhador</p>
            <p className="epi-doc__receipt-number">{data.worker.name}</p>
            <p className="epi-doc__meta">
              Gerada em {formatDateTime(data.generatedAt)}
            </p>
            <p className="epi-doc__meta">
              Periodo:{' '}
              {formatPeriodLabel(
                data.period?.from ?? null,
                data.period?.to ?? null,
              )}
            </p>
            <p className="epi-doc__status">
              {data.summary.deliveryCount} entrega(s) · {data.summary.itemCount}{' '}
              item(ns)
            </p>
          </div>
        </header>

        {works?.enabled &&
        includeWorkHistory &&
        works.history.length > 0 ? (
          <section className="epi-doc__section epi-doc__section--keep">
            <h2 className="epi-doc__section-title">Obras no periodo</h2>
            <div className="epi-doc__grid">
              {works.history.map((site) => (
                <div key={`${site.id}-${site.startAt}`}>
                  <span className="epi-doc__label">{site.name}</span>
                  <span>
                    {site.cnpj ? `CNPJ ${formatCnpj(site.cnpj)} · ` : ''}
                    {formatPeriodLabel(
                      site.startAt.slice(0, 10),
                      site.endAt ? site.endAt.slice(0, 10) : null,
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="epi-doc__section epi-doc__section--keep">
          <h2 className="epi-doc__section-title">Identificacao</h2>
          <div className="epi-doc__grid">
            <div>
              <span className="epi-doc__label">Matricula</span>
              <span>{data.worker.registration ?? '—'}</span>
            </div>
            <div>
              <span className="epi-doc__label">CPF</span>
              <span className="mono">{data.worker.cpfMasked ?? '—'}</span>
            </div>
            <div>
              <span className="epi-doc__label">Unidade</span>
              <span>{data.worker.unitName ?? '—'}</span>
            </div>
            <div>
              <span className="epi-doc__label">Setor</span>
              <span>{data.worker.sectorName ?? '—'}</span>
            </div>
            <div>
              <span className="epi-doc__label">Funcao</span>
              <span>{data.worker.jobFunctionName ?? '—'}</span>
            </div>
            <div>
              <span className="epi-doc__label">Status</span>
              <span>
                {data.worker.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        </section>

        {data.deliveries.length === 0 ? (
          <section className="epi-doc__section">
            <p className="epi-doc__meta">
              Nenhuma entrega encontrada para este filtro.
            </p>
          </section>
        ) : (
          data.deliveries.map((delivery) => (
            <section
              key={delivery.id}
              className="epi-doc__section portal-epi-sheet__delivery"
            >
              <h2 className="epi-doc__section-title">
                Entrega {delivery.receiptNumber} ·{' '}
                {formatDateTime(delivery.deliveredAt)} · {delivery.statusLabel}
              </h2>

              <table className="epi-doc__table epi-doc__table--sheet">
                <colgroup>
                  <col className="epi-col-epi" />
                  <col className="epi-col-ca" />
                  <col className="epi-col-qty" />
                  <col className="epi-col-life" />
                  <col className="epi-col-remain" />
                  <col className="epi-col-next" />
                  <col className="epi-col-status" />
                </colgroup>
                <thead>
                  <tr>
                    <th>EPI / necessidade</th>
                    <th>CA</th>
                    <th>Qtd</th>
                    <th>Vida util</th>
                    <th>Dias faltantes</th>
                    <th>Prox. troca</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {delivery.items.map((item) => (
                    <tr key={item.id}>
                      <td className="epi-doc__cell-epi">
                        <strong>{item.epiName}</strong>
                        <span className="epi-doc__sub">
                          {item.isExtra ? 'Extra (fora das indicacoes)' : item.needName}
                        </span>
                      </td>
                      <td className="mono epi-doc__cell-num">
                        {item.caNumber ?? '—'}
                      </td>
                      <td className="mono epi-doc__cell-num">{item.quantity}</td>
                      <td className="epi-doc__cell-meta">
                        {item.usefulLifeLabel ?? '—'}
                      </td>
                      <td className="epi-doc__cell-meta">
                        {item.remainingLabel ?? '—'}
                      </td>
                      <td className="epi-doc__cell-meta">
                        {item.nextReplacementAt
                          ? formatDate(item.nextReplacementAt)
                          : '—'}
                      </td>
                      <td className="epi-doc__cell-meta">{item.statusLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="portal-epi-sheet__evidence">
                <h3 className="epi-doc__section-title">
                  Evidencia facial desta entrega
                </h3>
                {delivery.evidence ? (
                  <PortalFacialEvidenceThumb
                    deliveryId={delivery.id}
                    hasFile={delivery.evidence.hasFile}
                    fileRemovedByRetention={
                      delivery.evidence.fileRemovedByRetention
                    }
                    capturedAtLabel={formatDateTime(
                      delivery.evidence.capturedAt,
                    )}
                  />
                ) : (
                  <p className="epi-doc__meta">
                    Sem evidencia facial nesta entrega.
                  </p>
                )}
              </div>
            </section>
          ))
        )}

        <section className="epi-doc__section epi-doc__section--keep">
          <h2 className="epi-doc__section-title">Termo da ficha</h2>
          <EpiLegalDeclarationBlock
            version={data.declaration.version}
            plainText={data.declaration.text}
          />
          <p className="epi-doc__meta">Versao {data.declaration.version}</p>
        </section>

        <footer className="epi-doc__footer">
          <p className="epi-doc__lgpd">
            Miniaturas faciais sao dados sensiveis (LGPD). Uso destinado a
            auditoria autenticada do fornecimento de EPI.
          </p>
        </footer>
      </article>
    </div>
  );
}
