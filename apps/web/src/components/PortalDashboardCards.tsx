'use client';

import Link from 'next/link';

export type PortalDashCardId =
  | 'entregas'
  | 'validade'
  | 'custos'
  | 'estoque';

type PortalDashCard = {
  id: PortalDashCardId;
  href: string;
  title: string;
  description: string;
  metricLabel: string;
};

const CARDS: PortalDashCard[] = [
  {
    id: 'entregas',
    href: '/portal/entregas',
    title: 'Entregas',
    description: 'Controle de entregas, fichas e pendencias da empresa.',
    metricLabel: 'Pendentes',
  },
  {
    id: 'validade',
    href: '/portal/validade',
    title: 'Validade',
    description: 'CA, vida util e vencimentos que exigem atencao.',
    metricLabel: 'Alertas',
  },
  {
    id: 'custos',
    href: '/portal/custos',
    title: 'Custos',
    description: 'Consumo e custo de EPI por periodo e unidade.',
    metricLabel: 'Periodo',
  },
  {
    id: 'estoque',
    href: '/portal/estoque',
    title: 'Estoque',
    description: 'Necessidades e EPIs vinculados a esta empresa.',
    metricLabel: 'Necessidades',
  },
];

type Props = {
  metrics?: Partial<Record<PortalDashCardId, string | number | null>>;
  ready?: Partial<Record<PortalDashCardId, boolean>>;
};

export function PortalDashboardCards({ metrics, ready }: Props) {
  return (
    <section className="portal-dash" aria-labelledby="portal-dash-title">
      <div className="portal-dash-intro">
        <h2 id="portal-dash-title" className="page-title page-title--sm">
          Painel operacional
        </h2>
        <p className="page-lead">
          Dia a dia da empresa cliente. Numeros vem da implantacao feita pela
          Consultoria e dos cadastros desta empresa.
        </p>
      </div>
      <div className="portal-dash-grid">
        {CARDS.map((card) => {
          const value = metrics?.[card.id];
          const hasValue =
            value !== undefined && value !== null && value !== '';
          const isReady = ready?.[card.id] ?? false;
          return (
            <Link
              key={card.id}
              href={card.href}
              className="portal-metric-card portal-metric-card--link"
              aria-labelledby={`portal-metric-${card.id}`}
            >
              <p className="portal-metric-kicker">{card.metricLabel}</p>
              <h3
                id={`portal-metric-${card.id}`}
                className="portal-metric-title"
              >
                {card.title}
              </h3>
              <p className="portal-metric-value" aria-live="polite">
                {hasValue ? String(value) : '—'}
              </p>
              <p className="portal-metric-desc">{card.description}</p>
              <span className="portal-metric-status">
                {isReady ? 'Abrir modulo' : 'Em preparacao'}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
