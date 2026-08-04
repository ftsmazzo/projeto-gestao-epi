import type { ReactNode } from 'react';

type PageHeaderProps = {
  kicker?: string;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
};

export function PageHeader({
  kicker,
  title,
  lead,
  actions,
  titleId,
}: PageHeaderProps) {
  return (
    <header className="module-header ux-page-header">
      <div className="ux-page-header__copy">
        {kicker ? <p className="page-kicker">{kicker}</p> : null}
        <h1 id={titleId} className="page-title">
          {title}
        </h1>
        {lead ? <div className="page-lead">{lead}</div> : null}
      </div>
      {actions ? <div className="ux-page-header__actions">{actions}</div> : null}
    </header>
  );
}
