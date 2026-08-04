import { APP_NAME, APP_TAGLINE } from '@gestao-epi/shared';
import { BrandMark } from './BrandMark';

type BrandLockupProps = {
  /** Texto sob o nome. Padrao: tagline do produto. */
  subtitle?: string;
  /** Variante clara (painel brand escuro) ou escura (fundo claro). */
  onDark?: boolean;
  className?: string;
};

/** Lockup: marca + nome + subtítulo para painéis de auth e hero. */
export function BrandLockup({
  subtitle = APP_TAGLINE,
  onDark = true,
  className,
}: BrandLockupProps) {
  return (
    <div
      className={`brand-lockup${onDark ? ' brand-lockup--on-dark' : ''}${className ? ` ${className}` : ''}`}
    >
      <BrandMark className="brand-lockup__mark" title={APP_NAME} />
      <div className="brand-lockup__text">
        <strong className="brand-lockup__name">{APP_NAME}</strong>
        {subtitle ? <span className="brand-lockup__sub">{subtitle}</span> : null}
      </div>
    </div>
  );
}
