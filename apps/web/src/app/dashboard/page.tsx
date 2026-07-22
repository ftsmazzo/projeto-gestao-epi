'use client';

import Link from 'next/link';
import { OPS_NAV } from '../../lib/nav';
import { RequireAuth } from '../../components/RequireAuth';

export default function DashboardPage() {
  return (
    <RequireAuth>
      {(user) => (
        <div className="module-page">
          <header className="module-header">
            <div>
              <p className="page-kicker">Dashboard</p>
              <h1 className="page-title">Ola, {user.name}</h1>
              <p className="page-lead">
                Painel da empresa usuaria{' '}
                <strong>{user.organization.name}</strong>. Use o menu para
                navegar pelos modulos; a maioria ainda esta em preparacao.
              </p>
            </div>
            <Link className="btn btn-primary" href="/clientes">
              Abrir clientes atendidos
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
                  <dd>{user.email}</dd>
                </div>
                <div>
                  <dt>Papel</dt>
                  <dd>{user.membershipRole}</dd>
                </div>
                <div>
                  <dt>Slug</dt>
                  <dd>{user.organization.slug}</dd>
                </div>
              </dl>
            </section>

            <section className="surface" aria-labelledby="life-quota">
              <p className="page-kicker">Franquia</p>
              <h2 id="life-quota" className="page-title page-title--sm">
                Vidas contratadas
              </h2>
              <p className="quota-value">
                {user.organization.contractedLifeQuota}
              </p>
              <p className="field-hint">
                Franquia total do contrato. Cotas por cliente ainda nao foram
                alocadas.
              </p>
            </section>

            <section className="surface" aria-labelledby="client-quotas">
              <p className="page-kicker">Cotas</p>
              <h2 id="client-quotas" className="page-title page-title--sm">
                Cotas por cliente
              </h2>
              <div className="empty-inline">
                <p className="page-lead">
                  Nenhum cliente atendido cadastrado. A distribuicao de vidas
                  por CNPJ entra na proxima etapa de cadastros.
                </p>
                <Link className="btn btn-secondary" href="/clientes">
                  Ver modulo de clientes
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
                <li>Consulta da franquia total de vidas</li>
                <li>Navegacao pelos modulos futuros</li>
              </ul>
              <div className="btn-row">
                <Link className="btn btn-primary" href="/configuracoes">
                  Ir para configuracoes
                </Link>
                <Link className="btn btn-secondary" href="/portal-cliente">
                  Ver portal do cliente
                </Link>
              </div>
            </section>
          </div>
        </div>
      )}
    </RequireAuth>
  );
}
