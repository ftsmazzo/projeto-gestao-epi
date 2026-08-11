'use client';

import type { PortalAttentionCard } from '@gestao-epi/shared';
import Link from 'next/link';

type Props = {
  cards: PortalAttentionCard[];
};

export function PortalDashboardCards({ cards }: Props) {
  const visible = cards.filter((card) => card.visible);
  const alertCount = visible.filter((card) => card.id !== 'deliveries').length;

  return (
    <section className="portal-dash dash-panel" aria-labelledby="portal-dash-title" style={{ minHeight: 0, marginTop: '0.25rem' }}>
      <div className="dash-panel__head portal-dash-intro">
        <h2 id="portal-dash-title">Precisa de atencao</h2>
        <p>
          {alertCount === 0
            ? 'Nenhum alerta critico no momento.'
            : `${alertCount} ponto(s) pedindo decisao agora.`}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="notice" role="status">
          Tudo em dia — sem trocas proximas, CA em alerta, estoque baixo ou
          biometria pendente.
        </p>
      ) : (
        <div className="portal-dash-grid portal-dash-grid--attention">
          {visible.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className={`portal-attention-card portal-attention-card--${card.tone}`}
              aria-labelledby={`portal-attention-${card.id}`}
            >
              <p className="portal-attention-card__kicker">{card.label}</p>
              <h3
                id={`portal-attention-${card.id}`}
                className="portal-attention-card__title"
              >
                {card.title}
              </h3>
              <p className="portal-attention-card__value" aria-live="polite">
                {card.count}
              </p>
              <p className="portal-attention-card__detail">{card.detail}</p>
              <span className="portal-attention-card__action">Abrir</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
