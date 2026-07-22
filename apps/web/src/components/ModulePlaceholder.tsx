import Link from 'next/link';

type ModulePlaceholderProps = {
  kicker: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  primaryActionLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  upcoming?: string[];
};

export function ModulePlaceholder({
  kicker,
  title,
  description,
  emptyTitle,
  emptyDescription,
  primaryActionLabel,
  secondaryHref = '/dashboard',
  secondaryLabel = 'Voltar ao dashboard',
  upcoming = [],
}: ModulePlaceholderProps) {
  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">{kicker}</p>
          <h1 className="page-title">{title}</h1>
          <p className="page-lead">{description}</p>
        </div>
        <button type="button" className="btn btn-primary" disabled>
          {primaryActionLabel}
        </button>
      </header>

      <section className="surface empty-state" aria-labelledby="empty-title">
        <p className="status-pill" role="status">
          <span className="dot" aria-hidden="true" />
          Modulo em preparacao
        </p>
        <h2 id="empty-title" className="page-title page-title--sm">
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
          <Link className="btn btn-secondary" href={secondaryHref}>
            {secondaryLabel}
          </Link>
        </div>
      </section>
    </div>
  );
}
