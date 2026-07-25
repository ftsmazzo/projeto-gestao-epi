'use client';

import type {
  BiometricRetentionPendingResponse,
  BiometricRetentionRunResult,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import {
  getBiometricRetentionPending,
  runBiometricRetention,
} from '../../lib/workers';

function isAdminRole(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

function deletionLabel(status: string) {
  switch (status) {
    case 'PENDING':
      return 'Exclusao pendente';
    case 'FAILED':
      return 'Falha na exclusao';
    case 'DELETED':
      return 'Excluida';
    default:
      return status;
  }
}

export default function BiometriaRetencaoPage() {
  return (
    <RequireAuth>
      {(user) =>
        isAdminRole(user.membershipRole) ? (
          <RetentionAdmin />
        ) : (
          <main className="page">
            <p className="notice notice--warn" role="alert">
              Apenas OWNER ou ADMIN podem executar a retencao biometrica.
            </p>
            <Link className="btn btn-secondary" href="/dashboard">
              Voltar
            </Link>
          </main>
        )
      }
    </RequireAuth>
  );
}

function RetentionAdmin() {
  const [pending, setPending] =
    useState<BiometricRetentionPendingResponse | null>(null);
  const [lastRun, setLastRun] = useState<BiometricRetentionRunResult | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPending(await getBiometricRetentionPending());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar pendencias de retencao.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleRun() {
    const ok = window.confirm(
      'Executar exclusao agora? Arquivos e templates elegiveis serao removidos de forma irreversivel.',
    );
    if (!ok) return;
    setRunning(true);
    setError(null);
    try {
      const result = await runBiometricRetention();
      setLastRun(result);
      await reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao executar retencao biometrica.',
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <p className="page-kicker">Administracao · LGPD</p>
        <h1 className="page-title">Retencao biometrica</h1>
        <p className="page-lead">
          Exclusao segura de referencias e evidencias faciais marcadas como
          pendentes. Sem exposicao de imagem ou template.
        </p>
      </header>

      {error ? (
        <p className="notice notice--warn" role="alert">
          {error}
        </p>
      ) : null}

      {lastRun ? (
        <p className="notice notice--info" role="status">
          Ultima execucao: {lastRun.referencesDeleted} referencia(s) e{' '}
          {lastRun.evidencesDeleted} evidencia(s) excluidas
          {lastRun.referencesFailed + lastRun.evidencesFailed > 0
            ? ` · ${lastRun.referencesFailed + lastRun.evidencesFailed} falha(s)`
            : ''}
          .
        </p>
      ) : null}

      <div className="btn-row" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleRun()}
          disabled={running || loading}
        >
          {running ? 'Executando...' : 'Executar exclusao agora'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void reload()}
          disabled={loading || running}
        >
          Atualizar
        </button>
        <Link className="btn btn-secondary" href="/dashboard">
          Voltar
        </Link>
      </div>

      {loading && !pending ? (
        <p className="page-lead">Carregando...</p>
      ) : pending ? (
        <>
          <p className="table-sub">
            Pendentes: {pending.summary.referencesPending} referencia(s),{' '}
            {pending.summary.evidencesPending} evidencia(s)
            {pending.summary.referencesFailed +
              pending.summary.evidencesFailed >
            0
              ? ` · Falhas: ${pending.summary.referencesFailed + pending.summary.evidencesFailed}`
              : ''}
          </p>

          <section className="page-section">
            <h2 className="page-title page-title--sm">Referencias faciais</h2>
            {pending.references.length === 0 ? (
              <p className="field-hint">Nenhuma pendencia.</p>
            ) : (
              <ul className="stack-list">
                {pending.references.map((row) => (
                  <li key={row.id}>
                    <strong>{row.workerName}</strong>
                    <span className="table-sub">
                      {' '}
                      · {deletionLabel(row.deletionStatus)}
                      {row.deletionError ? ` · ${row.deletionError}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="page-section">
            <h2 className="page-title page-title--sm">Evidencias de entrega</h2>
            {pending.evidences.length === 0 ? (
              <p className="field-hint">Nenhuma pendencia.</p>
            ) : (
              <ul className="stack-list">
                {pending.evidences.map((row) => (
                  <li key={row.id}>
                    <strong>{row.receiptNumber}</strong> — {row.workerName}
                    <span className="table-sub">
                      {' '}
                      · {deletionLabel(row.deletionStatus)}
                      {row.deletionError ? ` · ${row.deletionError}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
