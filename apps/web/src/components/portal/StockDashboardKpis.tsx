'use client';

type Kpi = {
  id: string;
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'ok' | 'warn' | 'danger';
};

type Props = {
  items: Kpi[];
};

export function StockDashboardKpis({ items }: Props) {
  return (
    <section className="dash-kpi-grid" aria-label="Indicadores de estoque">
      {items.map((item) => (
        <article
          key={item.id}
          className={`dash-kpi${item.tone && item.tone !== 'default' ? ` dash-kpi--${item.tone}` : ''}`}
        >
          <p className="dash-kpi__label">{item.label}</p>
          <p className="dash-kpi__value">{item.value}</p>
          {item.hint ? <p className="dash-kpi__hint">{item.hint}</p> : null}
        </article>
      ))}
    </section>
  );
}
