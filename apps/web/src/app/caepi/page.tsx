'use client';

import type {
  AuthUser,
  CaepiImportRun,
  CaepiStatusResponse,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import {
  getCaepiImportRun,
  getCaepiStatus,
  listCaepiImportRuns,
  startCaepiSync,
  uploadCaepiFile,
} from '../../lib/caepi-admin';

const POLL_MS = 2500;

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

function statusLabel(status: CaepiImportRun['status']) {
  switch (status) {
    case 'PENDING':
      return 'Pendente';
    case 'RUNNING':
      return 'Em execucao';
    case 'SUCCESS':
      return 'Sucesso';
    case 'FAILED':
      return 'Falhou';
    default:
      return status;
  }
}

function triggeredLabel(value: CaepiImportRun['triggeredBy']) {
  switch (value) {
    case 'MANUAL':
      return 'Manual';
    case 'SCHEDULED':
      return 'Agendada';
    case 'UPLOAD':
      return 'Upload';
    default:
      return value;
  }
}

function isAdminRole(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

export default function CaepiAdminPage() {
  return (
    <RequireAuth>
      {(user) => <CaepiAdminContent user={user} />}
    </RequireAuth>
  );
}

function CaepiAdminContent({ user }: { user: AuthUser }) {
  const canManage = isAdminRole(user.membershipRole);
  const [status, setStatus] = useState<CaepiStatusResponse | null>(null);
  const [runs, setRuns] = useState<CaepiImportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [nextStatus, nextRuns] = await Promise.all([
        getCaepiStatus(),
        listCaepiImportRuns(20),
      ]);
      setStatus(nextStatus);
      setRuns(nextRuns);
      if (
        nextStatus.activeRun &&
        (nextStatus.activeRun.status === 'PENDING' ||
          nextStatus.activeRun.status === 'RUNNING')
      ) {
        setActiveRunId(nextStatus.activeRun.id);
        setSyncing(true);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar o status CAEPI.',
      );
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeRunId || !canManage) return;

    let cancelled = false;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const run = await getCaepiImportRun(activeRunId);
          if (cancelled) return;
          setRuns((prev) => {
            const others = prev.filter((item) => item.id !== run.id);
            return [run, ...others].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );
          });

          if (run.status === 'SUCCESS' || run.status === 'FAILED') {
            setSyncing(false);
            setActiveRunId(null);
            if (run.status === 'SUCCESS') {
              setActionMessage(
                `Atualizacao concluida. Certificados: ${run.certificatesTotalAfter ?? '—'} · Normas: ${run.normsTotalAfter ?? '—'}.`,
              );
            } else {
              setActionError(
                run.errorMessage ?? 'A atualizacao CAEPI falhou.',
              );
            }
            const nextStatus = await getCaepiStatus();
            if (!cancelled) setStatus(nextStatus);
          }
        } catch (err) {
          if (cancelled) return;
          setActionError(
            err instanceof Error
              ? err.message
              : 'Falha ao consultar status da execucao.',
          );
        }
      })();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeRunId, canManage]);

  const busy = useMemo(() => {
    return (
      syncing ||
      status?.activeRun?.status === 'PENDING' ||
      status?.activeRun?.status === 'RUNNING'
    );
  }, [status?.activeRun?.status, syncing]);

  async function onSyncNow() {
    setActionError(null);
    setActionMessage(null);
    if (!status?.sourceUrlConfigured) {
      setActionError(
        'CAEPI_SOURCE_URL nao configurada no ambiente da API. Defina a URL oficial baixavel e reinicie o servico.',
      );
      return;
    }

    setSyncing(true);
    try {
      const started = await startCaepiSync();
      setActiveRunId(started.runId);
      setActionMessage('Atualizacao iniciada. Acompanhe o status abaixo.');
      await load();
    } catch (err) {
      setSyncing(false);
      setActiveRunId(null);
      setActionError(
        err instanceof Error ? err.message : 'Falha ao iniciar sincronizacao.',
      );
    }
  }

  async function onUpload(event: FormEvent) {
    event.preventDefault();
    setActionError(null);
    setActionMessage(null);
    if (!uploadFile) {
      setActionError('Selecione um arquivo CAEPI para upload.');
      return;
    }

    setSyncing(true);
    try {
      const started = await uploadCaepiFile(uploadFile);
      setActiveRunId(started.runId);
      setActionMessage(
        'Upload enfileirado (fallback). Acompanhe o status da execucao.',
      );
      setUploadFile(null);
      await load();
    } catch (err) {
      setSyncing(false);
      setActiveRunId(null);
      setActionError(
        err instanceof Error ? err.message : 'Falha no upload CAEPI.',
      );
    }
  }

  if (!canManage) {
    return (
      <div className="module-page">
        <header className="module-header">
          <div>
            <p className="page-kicker">Administracao</p>
            <h1 className="page-title">Base CAEPI</h1>
            <p className="page-lead">
              A atualizacao da base oficial e restrita a OWNER ou ADMIN.
            </p>
          </div>
        </header>
        <section className="surface">
          <p className="error" role="alert">
            Seu papel ({user.membershipRole}) nao permite gerenciar a base
            CAEPI.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Administracao</p>
          <h1 className="page-title">Base CAEPI</h1>
          <p className="page-lead">
            Atualize e monitore a base oficial de Certificados de Aprovacao
            usada no cadastro assistido de EPIs.
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || loading}
            onClick={() => void onSyncNow()}
          >
            {busy ? 'Atualizando...' : 'Atualizar base CAEPI agora'}
          </button>
          <Link className="btn btn-secondary" href="/epis">
            Ir para EPIs
          </Link>
        </div>
      </header>

      {loading ? (
        <section className="surface">
          <p className="page-lead">Carregando status operacional...</p>
        </section>
      ) : null}

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {actionError ? (
        <p className="error" role="alert">
          {actionError}
        </p>
      ) : null}
      {actionMessage ? (
        <p className="caepi-applied" role="status">
          {actionMessage}
        </p>
      ) : null}

      {status ? (
        <>
          {status.operationalMessage ? (
            <p className="caepi-message" role="status">
              {status.operationalMessage}
            </p>
          ) : null}

          <section className="surface caepi-admin-summary" aria-label="Resumo">
            <dl className="meta-list">
              <div>
                <dt>Total de CAs</dt>
                <dd>{status.certificatesTotal}</dd>
              </div>
              <div>
                <dt>Total de normas/laudos</dt>
                <dd>{status.normsTotal}</dd>
              </div>
              <div>
                <dt>Ultima atualizacao</dt>
                <dd>
                  {formatDateTime(
                    status.lastImport?.finishedAt ??
                      status.lastImport?.startedAt,
                  )}
                </dd>
              </div>
              <div>
                <dt>Status da ultima execucao</dt>
                <dd>
                  {status.lastImport
                    ? statusLabel(status.lastImport.status)
                    : 'Nenhuma'}
                </dd>
              </div>
              <div>
                <dt>Origem configurada</dt>
                <dd className="caepi-admin-url">
                  {status.sourceUrlConfigured
                    ? status.sourceUrl
                    : 'Nao configurada (CAEPI_SOURCE_URL)'}
                </dd>
              </div>
              <div>
                <dt>Auto sync</dt>
                <dd>
                  {status.autoSyncEnabled
                    ? `Ativo (${status.syncCron})`
                    : 'Desabilitado'}
                </dd>
              </div>
            </dl>
            {status.baseIncomplete ? (
              <p className="caepi-alert caepi-alert--warn" role="alert">
                Base vazia ou incompleta (limiar: {status.incompleteThreshold}{' '}
                certificados). Atualize pela URL oficial.
              </p>
            ) : (
              <p className="caepi-alert caepi-alert--ok">
                Base local com volume operacional adequado.
              </p>
            )}
          </section>

          <section className="surface" aria-labelledby="caepi-history">
            <div className="epi-form-section__head">
              <h2 id="caepi-history" className="page-title page-title--sm">
                Historico de execucoes
              </h2>
              <p>Ultimas sincronizacoes e uploads da base oficial.</p>
            </div>
            {runs.length === 0 ? (
              <p className="empty-state">Nenhuma execucao registrada ainda.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Origem</th>
                      <th>Arquivo</th>
                      <th>Inicio</th>
                      <th>Fim</th>
                      <th>Lidas</th>
                      <th>Criados</th>
                      <th>Atualizados</th>
                      <th>Total CAs</th>
                      <th>Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.id}>
                        <td>
                          <span
                            className={`caepi-run-status caepi-run-status--${run.status.toLowerCase()}`}
                          >
                            {statusLabel(run.status)}
                          </span>
                        </td>
                        <td>{triggeredLabel(run.triggeredBy)}</td>
                        <td>{run.fileName || '—'}</td>
                        <td>{formatDateTime(run.startedAt)}</td>
                        <td>{formatDateTime(run.finishedAt)}</td>
                        <td>{run.rowsRead ?? '—'}</td>
                        <td>{run.certificatesCreated ?? '—'}</td>
                        <td>{run.certificatesUpdated ?? '—'}</td>
                        <td>{run.certificatesTotalAfter ?? '—'}</td>
                        <td className="caepi-admin-error">
                          {run.errorMessage || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="surface" aria-labelledby="caepi-fallback">
            <div className="epi-form-section__head">
              <h2 id="caepi-fallback" className="page-title page-title--sm">
                Fallback: upload manual
              </h2>
              <p>
                Use apenas se a URL oficial estiver indisponivel. O fluxo
                principal e o botao de atualizacao automatica.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setUploadOpen((open) => !open)}
            >
              {uploadOpen ? 'Ocultar upload' : 'Mostrar upload manual'}
            </button>
            {uploadOpen ? (
              <form className="form form--wide" onSubmit={onUpload}>
                <div className="field">
                  <label htmlFor="caepi-upload">Arquivo CAEPI</label>
                  <input
                    id="caepi-upload"
                    type="file"
                    accept=".csv,.txt,.tsv,.xlsx,.xls,.zip"
                    onChange={(e) =>
                      setUploadFile(e.target.files?.[0] ?? null)
                    }
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={busy || !uploadFile}
                >
                  Enviar arquivo (fallback)
                </button>
              </form>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
