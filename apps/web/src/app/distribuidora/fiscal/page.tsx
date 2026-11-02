'use client';

import { useEffect, useState } from 'react';
import { fetchMe } from '../../../lib/auth';
import {
  getDistributorFiscal,
  isDistributorManager,
  type DistributorFiscalProfile,
} from '../../../lib/distributor';

export default function DistribuidoraFiscalPage() {
  const [profile, setProfile] = useState<DistributorFiscalProfile | null>(null);
  const [manager, setManager] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([getDistributorFiscal(), fetchMe()])
      .then(([row, me]) => {
        setProfile(row);
        setManager(isDistributorManager(me.membershipRole));
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Cadastro</p>
          <h1 className="page-title">Fiscal</h1>
          <p className="page-lead">
            Identidade e certificado A1 ficam no Gateway Fiscal. Aqui só aparece
            o vínculo com o emitente.
          </p>
        </div>
      </header>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {profile ? (
        <>
          <section className="dash-kpi-grid" aria-label="Conexao fiscal">
            <article
              className={`dash-kpi ${profile.gatewayConfigured ? 'dash-kpi--ok' : 'dash-kpi--warn'}`}
            >
              <p className="dash-kpi__label">Gateway Fiscal</p>
              <p className="dash-kpi__value">
                {profile.gatewayConfigured ? 'Conectado' : 'Pendente'}
              </p>
            </article>
            <article className={`dash-kpi ${profile.cnpj ? 'dash-kpi--ok' : 'dash-kpi--warn'}`}>
              <p className="dash-kpi__label">CNPJ emitente</p>
              <p className="dash-kpi__value">{profile.cnpj ?? '—'}</p>
            </article>
            <article className={`dash-kpi ${profile.uf ? 'dash-kpi--ok' : 'dash-kpi--warn'}`}>
              <p className="dash-kpi__label">UF</p>
              <p className="dash-kpi__value">{profile.uf ?? '—'}</p>
            </article>
            <article
              className={`dash-kpi ${profile.certificateUploaded ? 'dash-kpi--ok' : 'dash-kpi--warn'}`}
            >
              <p className="dash-kpi__label">Certificado A1</p>
              <p className="dash-kpi__value">
                {profile.certificateUploaded ? 'No Gateway' : 'Pendente'}
              </p>
            </article>
          </section>
          <section className="dash-panel" aria-label="Emitente">
            <h2 className="dash-panel__title">Emitente sincronizado</h2>
            <dl className="field-hint" style={{ margin: 0 }}>
              <div>
                <dt>IE</dt>
                <dd>{profile.stateRegistration ?? '—'}</dd>
              </div>
              <div>
                <dt>Regime</dt>
                <dd>
                  {profile.regime === 'PRESUMIDO'
                    ? 'Presumido'
                    : profile.regime === 'SIMPLES'
                      ? 'Simples'
                      : 'Real'}
                </dd>
              </div>
              <div>
                <dt>Emissão</dt>
                <dd>{profile.emissionEnabled ? 'Ligada' : 'Homologação / mock'}</dd>
              </div>
            </dl>
            <p className="field-hint">{profile.note}</p>
            {!manager ? (
              <p className="field-hint">Somente gestor vê detalhes operacionais.</p>
            ) : null}
            {profile.missing.length > 0 ? (
              <p className="error" role="status">
                Pendências: {profile.missing.join(', ')}
              </p>
            ) : (
              <p className="field-hint">Pronto para montar nota de saída a partir de orçamento aprovado.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
