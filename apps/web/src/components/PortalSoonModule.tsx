'use client';

import Link from 'next/link';

type Props = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  upcoming?: string[];
};

/** Pagina-base de modulo operacional no Painel do Cliente. */
export function PortalSoonModule({
  title,
  description,
  emptyTitle,
  emptyDescription,
  upcoming = [],
}: Props) {
  return (
    <div className="portal-home">
      <header className="portal-home-header">
        <div>
          <p className="page-kicker">Dia a dia</p>
          <h1 className="page-title page-title--sm">{title}</h1>
          <p className="page-lead">{description}</p>
        </div>
      </header>

      <section className="portal-card" aria-labelledby="portal-module-empty">
        <p className="status-pill status-pill--inactive" role="status">
          Modulo em preparacao
        </p>
        <h2 id="portal-module-empty" className="page-title page-title--sm">
          {emptyTitle}
        </h2>
        <p className="page-lead">{emptyDescription}</p>
        {upcoming.length > 0 ? (
          <ul className="upcoming-list">
            {upcoming.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <div className="btn-row">
          <Link className="btn btn-secondary" href="/portal">
            Voltar ao painel
          </Link>
        </div>
      </section>
    </div>
  );
}
