import Link from 'next/link';

type BrandProps = {
  href?: string;
  compact?: boolean;
};

export function Brand({ href = '/', compact = false }: BrandProps) {
  const content = (
    <>
      <span className="brand-mark" aria-hidden="true" />
      <span className="brand-text">
        <strong>Gestao Digital de EPI</strong>
        {!compact ? <span>Entrega operacional e conformidade</span> : null}
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
