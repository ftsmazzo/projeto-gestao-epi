import Link from 'next/link';
import { APP_NAME, APP_TAGLINE } from '@gestao-epi/shared';
import { BrandMark } from './BrandMark';

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
        <BrandMark className="brand-mark__img" title="" />
      </span>
      <span className="brand-text">
        <strong>{APP_NAME}</strong>
        {!compact ? (
          <span>
            {tone === 'portal' ? 'Painel operacional do cliente' : APP_TAGLINE}
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
