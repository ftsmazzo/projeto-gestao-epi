'use client';

import type {
  ClientPortalUser,
  PgroDiffRow,
  PgroImportConfirmResult,
  PortalPgroPreview,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { RequireClientAuth } from '../../../../components/RequireClientAuth';
import {
  confirmPortalPgr,
  previewPortalPgr,
} from '../../../../lib/client-auth';

function formatCnpj(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length !== 14) return value || '—';
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5',
  );
}

function DiffTable({
  title,
  rows,
  empty,
  tone,
}: {
  title: string;
  rows: PgroDiffRow[];
  empty: string;
  tone?: 'ok' | 'warn' | 'new';
}) {
  return (
    <section className="dash-panel" style={{ minHeight: 0 }}>
      <div className="dash-panel__head">
        <h2>{title}</h2>
        <p>
          {rows.length} item{rows.length === 1 ? '' : 's'}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="dash-panel__empty" style={{ padding: '1rem' }}>
          {empty}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table data-table--refined">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Setor</th>
                <th scope="col">Trabalhadores</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.sectorName ?? ''}:${row.name}`}>
                  <td>
                    <strong>{row.name}</strong>
                    {tone === 'warn' && row.workerCount > 0 ? (
                      <span className="status-pill status-pill--warn">
                        Realocar
                      </span>
                    ) : null}
                  </td>
                  <td>{row.sectorName ?? '—'}</td>
                  <td>{row.workerCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PortalAtualizarPgrContent({ user }: { user: ClientPortalUser }) {
  const isManager = user.role === 'CLIENT_MANAGER';
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PortalPgroPreview | null>(null);
  const [result, setResult] = useState<PgroImportConfirmResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const clientLabel = useMemo(
    () => user.servedClient.tradeName || user.servedClient.legalName,
    [user.servedClient],
  );

  async function onPreview() {
    if (!file) {
      setError('Selecione o PDF do PGR.');
      return;
    }
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const data = await previewPortalPgr(file);
      setPreview(data);
    } catch (err: unknown) {
      setPreview(null);
      setError(
        err instanceof Error ? err.message : 'Falha ao ler o PDF do PGR.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function onConfirm() {
    if (!preview?.run.id || !preview.company.canConfirm) return;
    setConfirming(true);
    setError(null);
    try {
      const data = await confirmPortalPgr(preview.run.id);
      setResult(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel confirmar a atualizacao.',
      );
    } finally {
      setConfirming(false);
    }
  }

  if (!isManager) {
    return (
      <div className="portal-home">
        <header className="dash-page-header">
          <div>
            <p className="page-kicker">Estrutura</p>
            <h1 className="page-title">Atualizar PGR</h1>
            <p className="page-lead">
              Somente o gestor da empresa pode reenviar o PGR.
            </p>
          </div>
          <div className="dash-page-header__actions">
            <Link className="btn btn-secondary" href="/portal/estrutura">
              Voltar
            </Link>
          </div>
        </header>
      </div>
    );
  }

  const summary = result?.summary;

  return (
    <div className="portal-home">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Estrutura</p>
          <h1 className="page-title">Atualizar PGR</h1>
          <p className="page-lead">
            Envie o PDF atualizado de {clientLabel}. Nada muda so com o upload:
            confira o que entra, o que permanece e o que sai das telas. Historico
            e fichas continuam.
          </p>
        </div>
        <div className="dash-page-header__actions">
          <Link className="btn btn-secondary" href="/portal/estrutura">
            Voltar a estrutura
          </Link>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {summary ? (
        <section className="dash-panel" style={{ minHeight: 0 }}>
          <div className="dash-panel__head">
            <h2>Atualizacao confirmada</h2>
            <p>A estrutura operacional ja reflete o PGR enviado.</p>
          </div>
          <ul className="estrutura-needs-list" style={{ padding: '1rem' }}>
            <li>
              Novos: {summary.sectorsCreated} setor(es),{' '}
              {summary.functionsCreated} funcao(oes)
            </li>
            <li>
              Reativados: {summary.sectorsReactivated ?? 0} setor(es),{' '}
              {summary.functionsReactivated ?? 0} funcao(oes)
            </li>
            <li>
              Arquivados: {summary.sectorsArchived ?? 0} setor(es),{' '}
              {summary.functionsArchived ?? 0} funcao(oes)
            </li>
            {(summary.workersInArchivedFunctions ?? 0) > 0 ? (
              <li>
                {summary.workersInArchivedFunctions} trabalhador(es) precisam
                ser realocados.
              </li>
            ) : null}
          </ul>
          <div className="btn-row" style={{ padding: '0 1rem 1rem' }}>
            <Link className="btn btn-primary" href="/portal/estrutura">
              Ver estrutura
            </Link>
            {(summary.workersInArchivedFunctions ?? 0) > 0 ? (
              <Link className="btn btn-secondary" href="/portal/trabalhadores">
                Realocar trabalhadores
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <>
          <section className="dash-panel" style={{ minHeight: 0 }}>
            <div className="dash-panel__head">
              <h2>1. Enviar PDF</h2>
              <p>Arquivo do PGR desta empresa.</p>
            </div>
            <div className="form-grid" style={{ padding: '1rem' }}>
              <label className="field">
                <span>PDF</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setPreview(null);
                    setResult(null);
                  }}
                />
              </label>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!file || uploading}
                  onClick={() => void onPreview()}
                >
                  {uploading ? 'Lendo PDF...' : 'Conferir diferencas'}
                </button>
              </div>
            </div>
          </section>

          {preview ? (
            <>
              <section className="dash-panel" style={{ minHeight: 0 }}>
                <div className="dash-panel__head">
                  <h2>2. Conferir empresa</h2>
                  <p>{preview.run.fileName}</p>
                </div>
                <div className="table-wrap">
                  <table className="data-table data-table--refined">
                    <tbody>
                      <tr>
                        <th scope="row">Empresa logada</th>
                        <td>
                          {preview.company.clientLegalName}
                          <br />
                          <span className="mono">
                            {formatCnpj(preview.company.clientCnpj)}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">No PDF</th>
                        <td>
                          {preview.company.parsedLegalName || '—'}
                          <br />
                          <span className="mono">
                            {formatCnpj(preview.company.parsedCnpj)}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {preview.company.cnpjMatches === false ? (
                  <p className="error" role="alert" style={{ padding: '1rem' }}>
                    CNPJ diferente. Este PGR nao pode ser aplicado nesta
                    empresa.
                  </p>
                ) : null}
              </section>

              {preview.warnings.length > 0 ? (
                <div className="notice notice--warn" role="status">
                  <p>
                    <strong>Avisos da leitura.</strong>{' '}
                    {preview.warnings.slice(0, 6).join(' ')}
                    {preview.warnings.length > 6
                      ? ` (+${preview.warnings.length - 6})`
                      : ''}
                  </p>
                </div>
              ) : null}

              <DiffTable
                title="Novos (entram na estrutura)"
                rows={[
                  ...preview.diff.sectorsAdded.map((row) => ({
                    ...row,
                    name: `Setor: ${row.name}`,
                  })),
                  ...preview.diff.functionsAdded,
                ]}
                empty="Nenhum setor ou funcao nova."
                tone="new"
              />
              <DiffTable
                title="Reativados (voltam as telas)"
                rows={[
                  ...preview.diff.sectorsReactivated.map((row) => ({
                    ...row,
                    name: `Setor: ${row.name}`,
                  })),
                  ...preview.diff.functionsReactivated,
                ]}
                empty="Nada para reativar."
              />
              <DiffTable
                title="Permanecem"
                rows={[
                  ...preview.diff.sectorsKept.map((row) => ({
                    ...row,
                    name: `Setor: ${row.name}`,
                  })),
                  ...preview.diff.functionsKept,
                ]}
                empty="Nenhum item igual ao PGR atual."
              />
              <DiffTable
                title="Saem das telas (historico permanece)"
                rows={[
                  ...preview.diff.sectorsToArchive.map((row) => ({
                    ...row,
                    name: `Setor: ${row.name}`,
                  })),
                  ...preview.diff.functionsToArchive,
                ]}
                empty="Nada a arquivar."
                tone="warn"
              />

              <section className="dash-panel" style={{ minHeight: 0 }}>
                <div className="dash-panel__head">
                  <h2>3. Confirmar</h2>
                  <p>
                    Riscos e necessidades de EPI do PDF serao ligados as funcoes
                    ativas. Remocoes nao apagam fichas nem relatorios.
                  </p>
                </div>
                <div className="btn-row" style={{ padding: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!preview.company.canConfirm || confirming}
                    onClick={() => void onConfirm()}
                  >
                    {confirming
                      ? 'Aplicando...'
                      : 'Confirmar atualizacao do PGR'}
                  </button>
                </div>
              </section>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function PortalAtualizarPgrPage() {
  return (
    <RequireClientAuth>
      {(user) => <PortalAtualizarPgrContent user={user} />}
    </RequireClientAuth>
  );
}
