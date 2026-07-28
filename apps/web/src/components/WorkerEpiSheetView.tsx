'use client';

import type { PortalWorkerEpiSheetResponse } from '@gestao-epi/shared';
import Link from 'next/link';
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

export function WorkerEpiSheetView({
  data,
  scope,
  onScopeChange,
}: {
  data: PortalWorkerEpiSheetResponse;
  scope: 'history' | 'open';
  onScopeChange?: (scope: 'history' | 'open') => void;
}) {
  const title = `Ficha de EPI — ${data.worker.name}`;

  return (
    <article className="portal-receipt portal-epi-sheet" aria-labelledby="epi-sheet-heading">
      <header className="portal-receipt__header">
        <p className="page-kicker">Painel do Cliente</p>
        <h1 id="epi-sheet-heading" className="page-title page-title--sm">
          {title}
        </h1>
        <p className="table-sub">
          Gerada em {formatDateTime(data.generatedAt)} ·{' '}
          {data.summary.deliveryCount} entrega(s) · {data.summary.itemCount}{' '}
          item(ns)
        </p>
      </header>

      <div className="btn-row no-print" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.print()}
        >
          Imprimir / salvar PDF
        </button>
        <Link className="btn btn-secondary" href="/portal/trabalhadores">
          Voltar aos trabalhadores
        </Link>
        {onScopeChange ? (
          <label className="portal-epi-sheet__scope">
            <span className="field-hint">Filtro</span>
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

      <section className="portal-receipt__block">
        <h2 className="page-title page-title--sm">Empresa</h2>
        <dl className="portal-receipt__dl">
          <div>
            <dt>Razao social</dt>
            <dd>{data.client.legalName}</dd>
          </div>
          {data.client.tradeName ? (
            <div>
              <dt>Nome fantasia</dt>
              <dd>{data.client.tradeName}</dd>
            </div>
          ) : null}
          <div>
            <dt>CNPJ</dt>
            <dd className="mono">{formatCnpj(data.client.cnpj)}</dd>
          </div>
        </dl>
      </section>

      <section className="portal-receipt__block">
        <h2 className="page-title page-title--sm">Trabalhador</h2>
        <dl className="portal-receipt__dl">
          <div>
            <dt>Nome</dt>
            <dd>{data.worker.name}</dd>
          </div>
          <div>
            <dt>Matricula</dt>
            <dd>{data.worker.registration ?? '—'}</dd>
          </div>
          <div>
            <dt>CPF</dt>
            <dd className="mono">{data.worker.cpfMasked ?? '—'}</dd>
          </div>
          <div>
            <dt>Unidade</dt>
            <dd>{data.worker.unitName ?? '—'}</dd>
          </div>
          <div>
            <dt>Setor</dt>
            <dd>{data.worker.sectorName ?? '—'}</dd>
          </div>
          <div>
            <dt>Funcao</dt>
            <dd>{data.worker.jobFunctionName ?? '—'}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{data.worker.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}</dd>
          </div>
        </dl>
      </section>

      {data.deliveries.length === 0 ? (
        <section className="portal-receipt__block">
          <p className="page-lead">Nenhuma entrega encontrada para este filtro.</p>
        </section>
      ) : (
        data.deliveries.map((delivery) => (
          <section
            key={delivery.id}
            className="portal-receipt__block portal-epi-sheet__delivery"
          >
            <h2 className="page-title page-title--sm">
              Entrega {delivery.receiptNumber}
            </h2>
            <p className="table-sub">
              {formatDateTime(delivery.deliveredAt)} · {delivery.statusLabel}
            </p>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Necessidade</th>
                    <th>EPI</th>
                    <th>CA</th>
                    <th>Qtd</th>
                    <th>Dev.</th>
                    <th>Status</th>
                    <th>Local</th>
                    <th>Prox. troca</th>
                  </tr>
                </thead>
                <tbody>
                  {delivery.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.needName}</td>
                      <td>{item.epiName}</td>
                      <td className="mono">{item.caNumber ?? '—'}</td>
                      <td className="mono">{item.quantity}</td>
                      <td className="mono">{item.returnedQuantity}</td>
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

            <div className="portal-epi-sheet__evidence">
              <h3 className="page-title page-title--sm">
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
                <p className="field-hint">Sem evidencia facial nesta entrega.</p>
              )}
            </div>
          </section>
        ))
      )}

      <section className="portal-receipt__block">
        <h2 className="page-title page-title--sm">Termo da ficha</h2>
        <p className="portal-receipt__consent">{data.declaration.text}</p>
        <p className="table-sub">Versao {data.declaration.version}</p>
        <p className="table-sub portal-receipt__lgpd">
          Miniaturas faciais sao dados sensiveis (LGPD). Uso destinado a auditoria
          autenticada do fornecimento de EPI.
        </p>
      </section>
    </article>
  );
}
