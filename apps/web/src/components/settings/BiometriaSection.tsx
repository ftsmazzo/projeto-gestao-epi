'use client';

import type {
  BiometricRetentionPendingResponse,
  BiometricRetentionRunResult,
  MembershipRole,
} from '@gestao-epi/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  getBiometricRetentionPending,
  runBiometricRetention,
} from '../../lib/workers';

function isAdminRole(role: MembershipRole) {
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

export function BiometriaSection({ role }: { role: MembershipRole }) {
  if (!isAdminRole(role)) {
    return (
      <div className="settings-section">
        <header className="settings-section__head">
          <h2 className="settings-section__title">Retencao biometrica</h2>
          <p className="page-lead">
            Apenas OWNER ou ADMIN podem executar a exclusao segura de
            referencias e evidencias faciais.
          </p>
        </header>
        <p className="notice notice--warn" role="alert">
          Seu papel atual nao permite esta acao.
        </p>
      </div>
    );
  }

  return <RetentionAdmin />;
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
    <div className="settings-section">
      <header className="settings-section__head">
        <h2 className="settings-section__title">Retencao biometrica</h2>
        <p className="page-lead">
          Exclusao segura de referencias e evidencias faciais marcadas como
          pendentes. Sem exposicao de imagem ou template.
        </p>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {lastRun ? (
        <p className="form-success" role="status">
          Ultima execucao: {lastRun.referencesDeleted} referencia(s) e{' '}
          {lastRun.evidencesDeleted} evidencia(s) excluidas
          {lastRun.referencesFailed + lastRun.evidencesFailed > 0
            ? ` · ${lastRun.referencesFailed + lastRun.evidencesFailed} falha(s)`
            : ''}
          .
        </p>
      ) : null}

      <section className="dash-panel" aria-labelledby="settings-bio-actions">
        <h3 id="settings-bio-actions" className="dash-panel__title">
          Execucao
        </h3>
        <p className="field-hint">
          {pending
            ? `Pendentes: ${pending.summary.referencesPending} referencia(s), ${pending.summary.evidencesPending} evidencia(s)${
                pending.summary.referencesFailed +
                  pending.summary.evidencesFailed >
                0
                  ? ` · Falhas: ${pending.summary.referencesFailed + pending.summary.evidencesFailed}`
                  : ''
              }`
            : loading
              ? 'Carregando pendencias...'
              : 'Sem resumo carregado.'}
        </p>
        <div className="btn-row">
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
        </div>
      </section>

      {pending ? (
        <>
          <section className="dash-panel" aria-labelledby="settings-bio-refs">
            <h3 id="settings-bio-refs" className="dash-panel__title">
              Referencias faciais
            </h3>
            {pending.references.length === 0 ? (
              <p className="empty-state">Nenhuma pendencia.</p>
            ) : (
              <ul className="settings-stack-list">
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

          <section className="dash-panel" aria-labelledby="settings-bio-ev">
            <h3 id="settings-bio-ev" className="dash-panel__title">
              Evidencias de entrega
            </h3>
            {pending.evidences.length === 0 ? (
              <p className="empty-state">Nenhuma pendencia.</p>
            ) : (
              <ul className="settings-stack-list">
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
    </div>
  );
}
