'use client';

import type { PortalDeliveryDetail } from '@gestao-epi/shared';
import Link from 'next/link';

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

export function DeliveryReceiptView({
  detail,
  showActions = true,
}: {
  detail: PortalDeliveryDetail;
  showActions?: boolean;
}) {
  return (
    <article className="portal-receipt" aria-labelledby="receipt-heading">
      <header className="portal-receipt__header">
        <p className="page-kicker">Painel do Cliente</p>
        <h1 id="receipt-heading" className="page-title page-title--sm">
          Comprovante de entrega de EPI
        </h1>
        <p className="portal-receipt__code mono">{detail.receiptNumber}</p>
        <p className="table-sub">
          Emitido em {formatDateTime(detail.deliveredAt)}
        </p>
      </header>

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
            <dd>{detail.status}</dd>
          </div>
          {detail.notes ? (
            <div>
              <dt>Observacoes</dt>
              <dd>{detail.notes}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="portal-receipt__block">
        <h2 className="page-title page-title--sm">Itens entregues</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Necessidade</th>
                <th>EPI real</th>
                <th>CA</th>
                <th>Validade CA</th>
                <th>Variacao</th>
                <th>Qtd</th>
                <th>Local</th>
                <th>Proxima troca</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.needName}</td>
                  <td>{item.epiName}</td>
                  <td className="mono">{item.caNumber ?? '—'}</td>
                  <td>{formatDate(item.caExpiresAt)}</td>
                  <td>{item.variantName ?? '—'}</td>
                  <td className="mono">{item.quantity}</td>
                  <td>{item.locationName}</td>
                  <td>{formatDate(item.nextReplacementAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-receipt__block">
        <h2 className="page-title page-title--sm">Evidencia facial</h2>
        {detail.evidence ? (
          <dl className="portal-receipt__dl">
            <div>
              <dt>Status</dt>
              <dd className="mono">{detail.evidence.statusLabel}</dd>
            </div>
            <div>
              <dt>Metodo</dt>
              <dd>{detail.evidence.method}</dd>
            </div>
            <div>
              <dt>Capturada em</dt>
              <dd>{formatDateTime(detail.evidence.capturedAt)}</dd>
            </div>
            <div>
              <dt>Arquivo</dt>
              <dd>
                {detail.evidence.hasFile
                  ? 'Registrado (acesso autenticado; nao exibido neste comprovante)'
                  : 'Ausente'}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="field-hint">Sem evidencia facial registrada.</p>
        )}
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
    </article>
  );
}
