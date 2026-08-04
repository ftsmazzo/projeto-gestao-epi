'use client';

import type { QuotaSummary } from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import { PageHeader } from '../../components/ui/PageHeader';
import { OPS_NAV } from '../../lib/nav';
import { hardResetOrganization } from '../../lib/organization';
import { getQuotaSummary } from '../../lib/served-clients';

export default function DashboardPage() {
  return (
    <RequireAuth>
      {(user) => (
        <DashboardContent
          userName={user.name}
          orgName={user.organization.name}
          email={user.email}
          role={user.membershipRole}
          slug={user.organization.slug}
        />
      )}
    </RequireAuth>
  );
}

function DashboardContent({
  userName,
  orgName,
  email,
  role,
  slug,
}: {
  userName: string;
  orgName: string;
  email: string;
  role: string;
  slug: string;
}) {
  const [summary, setSummary] = useState<QuotaSummary | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetOk, setResetOk] = useState<string | null>(null);

  useEffect(() => {
    void getQuotaSummary()
      .then(setSummary)
      .catch((err: unknown) => {
        setQuotaError(
          err instanceof Error
            ? err.message
            : 'Nao foi possivel carregar o resumo de cotas.',
        );
      });
  }, []);

  async function onHardReset(event: FormEvent) {
    event.preventDefault();
    setResetError(null);
    setResetOk(null);
    setResetting(true);
    try {
      const result = await hardResetOrganization(resetConfirm);
      setResetConfirm('');
      setResetOk(
        `Hard reset ok: ${result.servedClients} clientes, ${result.epiItems} EPIs, ${result.workers} trabalhadores removidos. Voce continua logado.`,
      );
      const next = await getQuotaSummary();
      setSummary(next);
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : 'Falha ao executar hard reset.',
      );
    } finally {
      setResetting(false);
    }
  }

  const hasClients = Boolean(summary && summary.totalClients > 0);

  return (
    <div className="module-page">
      <PageHeader
        kicker="Dashboard"
        title={`Ola, ${userName}`}
        lead={
          <>
            Painel da consultoria <strong>{orgName}</strong>. Foque na
            implantacao do proximo cliente e na franquia de vidas.
          </>
        }
        actions={
          <Link className="btn btn-primary" href="/clientes">
            {hasClients ? 'Gerenciar clientes' : 'Cadastrar primeiro cliente'}
          </Link>
        }
      />

      <section className="action-strip ux-enter" aria-label="Proximos passos">
        <Link href="/clientes" className="action-tile action-tile--primary">
          <p className="action-tile__kicker">Prioridade</p>
          <h2 className="action-tile__title">
            {hasClients ? 'Abrir clientes' : 'Novo cliente'}
          </h2>
          <p className="action-tile__desc">
            Cadastre CNPJ, aloque vidas, importe PGRO e libere o portal.
          </p>
        </Link>
        <Link href="/caepi" className="action-tile">
          <p className="action-tile__kicker">Base</p>
          <h2 className="action-tile__title">CAEPI</h2>
          <p className="action-tile__desc">
            Mantenha a base oficial de CAs atualizada para o catalogo.
          </p>
        </Link>
        <Link href="/portal-cliente" className="action-tile">
          <p className="action-tile__kicker">Operacao</p>
          <h2 className="action-tile__title">Portal do cliente</h2>
          <p className="action-tile__desc">
            Entenda o que o gestor da empresa ve no dia a dia.
          </p>
        </Link>
      </section>

      <div className="quota-summary ux-enter-delay" aria-label="Franquia de vidas">
        <div className="quota-summary-item">
          <span className="quota-summary-label">Contratadas</span>
          <strong className="quota-summary-value">
            {summary?.contracted ?? '—'}
          </strong>
        </div>
        <div className="quota-summary-item">
          <span className="quota-summary-label">Alocadas</span>
          <strong className="quota-summary-value">
            {summary?.allocated ?? '—'}
          </strong>
        </div>
        <div className="quota-summary-item">
          <span className="quota-summary-label">Usadas</span>
          <strong className="quota-summary-value">{summary?.used ?? '—'}</strong>
        </div>
        <div className="quota-summary-item">
          <span className="quota-summary-label">Disponiveis</span>
          <strong className="quota-summary-value">
            {summary?.available ?? '—'}
          </strong>
        </div>
      </div>
      {quotaError ? (
        <p className="error" role="alert">
          {quotaError}
        </p>
      ) : null}

      <div className="dashboard-grid dashboard-grid--ops">
        <section className="surface" aria-labelledby="org-summary">
          <p className="page-kicker">Organizacao</p>
          <h2 id="org-summary" className="page-title page-title--sm">
            Conta da consultoria
          </h2>
          <dl className="meta-list">
            <div>
              <dt>Email</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt>Papel</dt>
              <dd>{role}</dd>
            </div>
            <div>
              <dt>Slug</dt>
              <dd>{slug}</dd>
            </div>
            <div>
              <dt>Clientes</dt>
              <dd>
                {summary
                  ? `${summary.activeClients} ativos / ${summary.totalClients} total`
                  : '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="surface" aria-labelledby="next-modules">
          <p className="page-kicker">Modulos</p>
          <h2 id="next-modules" className="page-title page-title--sm">
            Navegacao rapida
          </h2>
          <ul className="module-link-list">
            {OPS_NAV.filter((item) => item.href !== '/dashboard').map(
              (item) => (
                <li key={item.href}>
                  <Link href={item.href} className="module-link-item">
                    <span>
                      <strong>{item.label}</strong>
                      <span className="field-hint">{item.description}</span>
                    </span>
                    <span className="ops-nav-badge">Ativo</span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        </section>

        {role === 'OWNER' ? (
          <section className="surface" aria-labelledby="hard-reset-title">
            <p className="page-kicker">Manutencao</p>
            <h2 id="hard-reset-title" className="page-title page-title--sm">
              Hard reset (dados de teste)
            </h2>
            <p className="page-lead">
              Apaga clientes, estrutura, trabalhadores, entregas, biometria,
              EPIs, estoque, PGRO e usuarios do cliente deste tenant. Mantem seu
              login, a organizacao e a base CAEPI. Digite{' '}
              <strong>RESETAR</strong> para confirmar.
            </p>
            <form className="form-grid" onSubmit={onHardReset}>
              <label>
                Confirmacao
                <input
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  placeholder="RESETAR"
                  autoComplete="off"
                />
              </label>
              <div className="btn-row">
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={
                    resetting ||
                    resetConfirm.trim().toUpperCase() !== 'RESETAR'
                  }
                >
                  {resetting ? 'Limpando...' : 'Executar hard reset'}
                </button>
              </div>
            </form>
            {resetError ? (
              <p className="error" role="alert">
                {resetError}
              </p>
            ) : null}
            {resetOk ? (
              <p className="notice notice--info" role="status">
                {resetOk}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
