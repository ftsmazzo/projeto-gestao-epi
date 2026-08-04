import Image from 'next/image';
import Link from 'next/link';
import { APP_NAME, APP_TAGLINE } from '@gestao-epi/shared';

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
        <Image
          src="/brand/prontepi-mark.png"
          alt=""
          width={36}
          height={36}
          className="brand-mark__img"
          priority
        />
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
