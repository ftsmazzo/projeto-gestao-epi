'use client';

import type { QuotaSummary } from '@gestao-epi/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import { OPS_NAV } from '../../lib/nav';
import { getQuotaSummary } from '../../lib/served-clients';

export default function DashboardPage() {
  return (
    <RequireAuth>
      {(user) => <DashboardContent userName={user.name} orgName={user.organization.name} email={user.email} role={user.membershipRole} slug={user.organization.slug} />}
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

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Dashboard</p>
          <h1 className="page-title">Ola, {userName}</h1>
          <p className="page-lead">
            Painel da empresa usuaria <strong>{orgName}</strong>. Acompanhe a
            franquia e os clientes atendidos.
          </p>
        </div>
        <Link className="btn btn-primary" href="/clientes">
          Gerenciar clientes
        </Link>
      </header>

      <div className="dashboard-grid dashboard-grid--ops">
        <section className="surface" aria-labelledby="org-summary">
          <p className="page-kicker">Organizacao</p>
          <h2 id="org-summary" className="page-title page-title--sm">
            Resumo do tenant
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
          </dl>
        </section>

        <section className="surface" aria-labelledby="life-quota">
          <p className="page-kicker">Franquia</p>
          <h2 id="life-quota" className="page-title page-title--sm">
            Vidas contratadas
          </h2>
          <p className="quota-value">{summary?.contracted ?? '—'}</p>
          <p className="field-hint">
            Franquia total do contrato. Alocadas: {summary?.allocated ?? '—'} ·
            Disponiveis: {summary?.available ?? '—'}.
          </p>
          {quotaError ? (
            <p className="error" role="alert">
              {quotaError}
            </p>
          ) : null}
        </section>

        <section className="surface" aria-labelledby="client-quotas">
          <p className="page-kicker">Cotas</p>
          <h2 id="client-quotas" className="page-title page-title--sm">
            Cotas por cliente
          </h2>
          {summary && summary.totalClients > 0 ? (
            <dl className="meta-list">
              <div>
                <dt>Clientes ativos</dt>
                <dd>{summary.activeClients}</dd>
              </div>
              <div>
                <dt>Total de clientes</dt>
                <dd>{summary.totalClients}</dd>
              </div>
              <div>
                <dt>Vidas usadas</dt>
                <dd>{summary.used} (trabalhadores ainda nao cadastrados)</dd>
              </div>
            </dl>
          ) : (
            <div className="empty-inline">
              <p className="page-lead">
                Nenhum cliente atendido cadastrado. Distribua a franquia por
                CNPJ no modulo de clientes.
              </p>
            </div>
          )}
          <div className="btn-row">
            <Link className="btn btn-secondary" href="/clientes">
              Abrir clientes atendidos
            </Link>
          </div>
        </section>

        <section className="surface" aria-labelledby="next-modules">
          <p className="page-kicker">Roteiro</p>
          <h2 id="next-modules" className="page-title page-title--sm">
            Proximos modulos
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
                    <span className="ops-nav-badge">
                      {item.status === 'ready' ? 'Ativo' : 'Em breve'}
                    </span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        </section>

        <section
          className="surface surface--graphite"
          aria-labelledby="actions"
        >
          <p className="page-kicker page-kicker--on-dark">Acoes</p>
          <h2 id="actions" className="page-title page-title--sm page-title--on-dark">
            O que ja e possivel
          </h2>
          <ul className="upcoming-list upcoming-list--on-dark">
            <li>Autenticacao e isolamento por organizacao</li>
            <li>Cadastro de clientes atendidos com CNPJ</li>
            <li>Distribuicao de cotas dentro da franquia</li>
          </ul>
          <div className="btn-row">
            <Link className="btn btn-primary" href="/clientes">
              Cadastrar cliente
            </Link>
            <Link className="btn btn-secondary" href="/portal-cliente">
              Ver portal do cliente
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
