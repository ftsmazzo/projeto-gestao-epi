'use client';

import type {
  AuthUser,
  CaCertificate,
  CaCertificateSearchItem,
  CaepiImportRun,
  CaepiStatusResponse,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import {
  lookupCaCertificate,
  normalizeCaQuery,
  searchCaCertificates,
} from '../../lib/caepi';
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

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function certStatusLabel(status: string) {
  switch (status) {
    case 'VALIDO':
      return 'Valido';
    case 'VENCIDO':
      return 'Vencido';
    case 'CANCELADO':
      return 'Cancelado';
    case 'SUSPENSO':
      return 'Suspenso';
    default:
      return status;
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
  const [lookupInput, setLookupInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupCert, setLookupCert] = useState<CaCertificate | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchItems, setSearchItems] = useState<CaCertificateSearchItem[]>(
    [],
  );
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

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
                run.errorMessage ??
                  'Nao foi possivel acessar a fonte oficial CAEPI. Verifique a conexao do servidor ou ajuste a URL tecnica nas variaveis de ambiente.',
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

  async function onLookupCa(event?: FormEvent) {
    event?.preventDefault();
    const ca = normalizeCaQuery(lookupInput);
    if (!ca) {
      setLookupError('Informe o numero do CA.');
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    setLookupMessage(null);
    setLookupCert(null);
    try {
      const res = await lookupCaCertificate(ca);
      if (res.found && res.certificate) {
        setLookupCert(res.certificate);
      } else {
        setLookupMessage(
          res.message ?? `CA ${ca} nao encontrado na base local.`,
        );
      }
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : 'Falha ao consultar o CA.',
      );
    } finally {
      setLookupLoading(false);
    }
  }

  async function onSearchEquipment(event?: FormEvent) {
    event?.preventDefault();
    const q = searchInput.trim();
    if (q.length < 3) {
      setSearchError('Informe ao menos 3 caracteres.');
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    setSearchMessage(null);
    setSearchItems([]);
    try {
      const res = await searchCaCertificates(q, 20);
      setSearchItems(res.items);
      setSearchMessage(
        res.message ??
          (res.items.length === 0
            ? 'Nenhum certificado encontrado para esse termo.'
            : null),
      );
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : 'Falha na busca CAEPI.',
      );
    } finally {
      setSearchLoading(false);
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
            O sistema usa a fonte oficial CAEPI do Ministerio do Trabalho.
            Atualize a base local com um clique — sem configurar URL, FTP ou
            arquivos externos.
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
                <dt>Origem da base</dt>
                <dd>
                  {status.usesOfficialDefaults
                    ? 'Fontes oficiais do Ministerio do Trabalho (padrao)'
                    : 'Override tecnico (CAEPI_SOURCE_URL)'}
                </dd>
              </div>
              <div>
                <dt>Ultima fonte usada</dt>
                <dd className="caepi-admin-url">
                  {status.lastImport?.sourceUrl || status.sourceUrl || '—'}
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

          </section>

          <section className="surface" aria-labelledby="caepi-consult">
            <div className="epi-form-section__head">
              <h2 id="caepi-consult" className="page-title page-title--sm">
                Consultar na base local
              </h2>
              <p>
                Confira se um CA oficial (ex.: 11442) foi importado, ou busque
                por equipamento. Vencidos tambem aparecem; validos vem primeiro.
              </p>
            </div>

            <form className="form form--wide" onSubmit={onLookupCa}>
              <div className="field">
                <label htmlFor="caepi-lookup-ca">Numero do CA</label>
                <input
                  id="caepi-lookup-ca"
                  autoComplete="off"
                  placeholder="Ex.: 11442"
                  value={lookupInput}
                  onChange={(e) => {
                    setLookupInput(normalizeCaQuery(e.target.value));
                    setLookupCert(null);
                    setLookupError(null);
                    setLookupMessage(null);
                  }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={lookupLoading || !lookupInput.trim()}
              >
                {lookupLoading ? 'Buscando...' : 'Buscar CA exato'}
              </button>
            </form>

            {lookupError ? (
              <p className="error" role="alert">
                {lookupError}
              </p>
            ) : null}
            {lookupMessage ? (
              <p className="caepi-message" role="status">
                {lookupMessage}
              </p>
            ) : null}
            {lookupCert ? (
              <dl className="meta-list" style={{ marginTop: '0.75rem' }}>
                <div>
                  <dt>CA</dt>
                  <dd>{lookupCert.caNumber}</dd>
                </div>
                <div>
                  <dt>Situacao</dt>
                  <dd>{certStatusLabel(lookupCert.status)}</dd>
                </div>
                <div>
                  <dt>Validade</dt>
                  <dd>{formatDate(lookupCert.expiresAt)}</dd>
                </div>
                <div>
                  <dt>Equipamento</dt>
                  <dd>{lookupCert.equipmentName || '—'}</dd>
                </div>
                <div>
                  <dt>Fabricante</dt>
                  <dd>{lookupCert.manufacturerName || '—'}</dd>
                </div>
                <div>
                  <dt>Referencia</dt>
                  <dd>{lookupCert.reference || '—'}</dd>
                </div>
              </dl>
            ) : null}

            <form
              className="form form--wide"
              style={{ marginTop: '1.25rem' }}
              onSubmit={onSearchEquipment}
            >
              <div className="field">
                <label htmlFor="caepi-search-eq">Equipamento / fabricante</label>
                <input
                  id="caepi-search-eq"
                  autoComplete="off"
                  placeholder="Ex.: Viseira, Protetor facial, Carbografite"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setSearchError(null);
                    setSearchMessage(null);
                  }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={searchLoading || searchInput.trim().length < 3}
              >
                {searchLoading ? 'Buscando...' : 'Buscar por texto'}
              </button>
            </form>

            {searchError ? (
              <p className="error" role="alert">
                {searchError}
              </p>
            ) : null}
            {searchMessage ? (
              <p className="caepi-message" role="status">
                {searchMessage}
              </p>
            ) : null}
            {searchItems.length > 0 ? (
              <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>CA</th>
                      <th>Situacao</th>
                      <th>Validade</th>
                      <th>Equipamento</th>
                      <th>Fabricante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchItems.map((item) => (
                      <tr key={item.caNumber}>
                        <td>{item.caNumber}</td>
                        <td>{certStatusLabel(item.status)}</td>
                        <td>{formatDate(item.expiresAt)}</td>
                        <td>{item.equipmentName || '—'}</td>
                        <td>{item.manufacturerName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="surface" aria-labelledby="caepi-fallback">
            <div className="epi-form-section__head">
              <h2 id="caepi-fallback" className="page-title page-title--sm">
                Fallback: upload manual
              </h2>
              <p>
                Prefira o botao &quot;Atualizar base CAEPI agora&quot; (baixa no
                servidor). Se enviar arquivo, use o <strong>ZIP</strong>{' '}
                oficial — o TXT descompactado costuma passar do limite e gerar
                &quot;too large&quot;.
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
