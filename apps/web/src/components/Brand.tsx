import Link from 'next/link';

type BrandProps = {
  href?: string;
  compact?: boolean;
  /** Variante visual: consultoria (padrao) ou portal. */
  tone?: 'ops' | 'portal';
};

export function Brand({
  href = '/',
  compact = false,
  tone = 'ops',
}: BrandProps) {
  const content = (
    <>
      <span className={`brand-mark brand-mark--${tone}`} aria-hidden="true">
        <span className="brand-mark__shield" />
      </span>
      <span className="brand-text">
        <strong>Gestao Digital de EPI</strong>
        {!compact ? (
          <span>
            {tone === 'portal'
              ? 'Operacao segura no dia a dia'
              : 'Implantacao e conformidade NR-06'}
          </span>
        ) : null}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="brand">
        {content}
      </Link>
    );
  }

  return <div className="brand">{content}</div>;
}
