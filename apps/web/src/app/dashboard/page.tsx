'use client';

import type { QuotaSummary } from '@gestao-epi/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClientPortalLaunchLink } from '../../components/ClientPortalLaunchLink';
import { RequireAuth } from '../../components/RequireAuth';
import { PageHeader } from '../../components/ui/PageHeader';
import { OPS_NAV } from '../../lib/nav';
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
          <Link className="btn btn-primary" href="/clientes?novo=1">
            {hasClients ? 'Novo cliente' : 'Cadastrar primeiro cliente'}
          </Link>
        }
      />

      <section className="action-strip ux-enter" aria-label="Proximos passos">
        <Link href="/clientes?novo=1" className="action-tile action-tile--primary">
          <p className="action-tile__kicker">Prioridade</p>
          <h2 className="action-tile__title">
            {hasClients ? 'Abrir clientes' : 'Novo cliente'}
          </h2>
          <p className="action-tile__desc">
            {hasClients
              ? 'Continue a implantacao ou cadastre outro CNPJ.'
              : 'Inserir dados manuais ou importar PGR — escolha no proximo passo.'}
          </p>
        </Link>
        <Link href="/clientes" className="action-tile">
          <p className="action-tile__kicker">Lista</p>
          <h2 className="action-tile__title">Clientes atendidos</h2>
          <p className="action-tile__desc">
            Veja cotas, abra o workspace e acompanhe a implantacao.
          </p>
        </Link>
        <ClientPortalLaunchLink className="action-tile">
          <p className="action-tile__kicker">Operacao</p>
          <h2 className="action-tile__title">Portal do cliente</h2>
          <p className="action-tile__desc">
            Abre em janela nova, sem usuario conectado.
          </p>
        </ClientPortalLaunchLink>
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
      </div>
    </div>
  );
}
