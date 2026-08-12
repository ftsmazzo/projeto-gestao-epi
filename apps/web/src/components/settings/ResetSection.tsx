'use client';

import type { MembershipRole } from '@gestao-epi/shared';
import { FormEvent, useState } from 'react';
import { hardResetOrganization } from '../../lib/organization';

export function ResetSection({ role }: { role: MembershipRole }) {
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetOk, setResetOk] = useState<string | null>(null);

  if (role !== 'OWNER') {
    return (
      <div className="settings-section">
        <header className="settings-section__head">
          <h2 className="settings-section__title">Reset geral</h2>
          <p className="page-lead">
            Apenas o administrador geral pode apagar os dados de teste deste
            tenant.
          </p>
        </header>
        <p className="notice notice--warn" role="alert">
          Seu papel atual nao permite esta acao.
        </p>
      </div>
    );
  }

  async function onHardReset(event: FormEvent) {
    event.preventDefault();
    setResetError(null);
    setResetOk(null);
    setResetting(true);
    try {
      const result = await hardResetOrganization(resetConfirm);
      setResetConfirm('');
      setResetOk(
        `Reset ok: ${result.servedClients} clientes, ${result.epiItems} EPIs, ${result.workers} trabalhadores removidos. Voce continua logado.`,
      );
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : 'Falha ao executar o reset.',
      );
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="settings-section">
      <header className="settings-section__head">
        <h2 className="settings-section__title">Reset geral</h2>
        <p className="page-lead">
          Apaga clientes, estrutura, trabalhadores, entregas, biometria, EPIs,
          estoque, PGRO e usuarios do cliente deste tenant. Mantem seu login, a
          organizacao e a base CAEPI.
        </p>
      </header>

      <section className="dash-panel settings-danger-panel" aria-labelledby="hard-reset-title">
        <h3 id="hard-reset-title" className="dash-panel__title">
          Confirmar exclusao
        </h3>
        <p className="page-lead">
          Acao irreversivel. Digite <strong>RESETAR</strong> para habilitar o
          botao.
        </p>
        <form className="form-grid" onSubmit={onHardReset}>
          <div className="field">
            <label htmlFor="hard-reset-confirm">Confirmacao</label>
            <input
              id="hard-reset-confirm"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="RESETAR"
              autoComplete="off"
            />
          </div>
          <div className="btn-row">
            <button
              type="submit"
              className="btn btn-danger"
              disabled={
                resetting || resetConfirm.trim().toUpperCase() !== 'RESETAR'
              }
            >
              {resetting ? 'Limpando...' : 'Executar reset geral'}
            </button>
          </div>
        </form>
        {resetError ? (
          <p className="form-error" role="alert">
            {resetError}
          </p>
        ) : null}
        {resetOk ? (
          <p className="form-success" role="status">
            {resetOk}
          </p>
        ) : null}
      </section>
    </div>
  );
}
