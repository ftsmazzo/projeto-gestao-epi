'use client';

export type PortalDashCardId =
  | 'entregas'
  | 'validade'
  | 'custos'
  | 'estoque';

type PortalDashCard = {
  id: PortalDashCardId;
  title: string;
  description: string;
  metricLabel: string;
};

const CARDS: PortalDashCard[] = [
  {
    id: 'entregas',
    title: 'Entregas',
    description: 'Controle de entregas, fichas e pendencias da empresa.',
    metricLabel: 'Pendentes',
  },
  {
    id: 'validade',
    title: 'Validade',
    description: 'CA, vida util e vencimentos que exigem atencao.',
    metricLabel: 'Alertas',
  },
  {
    id: 'custos',
    title: 'Custos',
    description: 'Consumo e custo de EPI por periodo e unidade.',
    metricLabel: 'Periodo',
  },
  {
    id: 'estoque',
    title: 'Estoque',
    description: 'Saldo, lotes e disponibilidade operacional.',
    metricLabel: 'Itens',
  },
];

type Props = {
  /** Quando houver API, passe valores reais por id. */
  metrics?: Partial<Record<PortalDashCardId, string | number>>;
};

export function PortalDashboardCards({ metrics }: Props) {
  return (
    <section
      className="portal-dash"
      aria-labelledby="portal-dash-title"
    >
      <div className="portal-dash-intro">
        <h2 id="portal-dash-title" className="page-title page-title--sm">
          Painel operacional
        </h2>
        <p className="page-lead">
          Espaco da empresa cliente para acompanhar operacao. Dados reais
          entram nas proximas etapas — a Consultoria nao opera daqui.
        </p>
      </div>
      <div className="portal-dash-grid">
        {CARDS.map((card) => {
          const value = metrics?.[card.id];
          const hasValue = value !== undefined && value !== null && value !== '';
          return (
            <article
              key={card.id}
              className="portal-metric-card"
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
              <span className="portal-metric-status">Em preparacao</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
