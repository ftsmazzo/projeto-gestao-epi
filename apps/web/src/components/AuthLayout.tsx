import type { ReactNode } from 'react';
import { Brand } from './Brand';

type Props = {
  children: ReactNode;
  kicker?: string;
  wide?: boolean;
  footer?: ReactNode;
  brandHref?: string;
  brandTone?: 'ops' | 'portal';
};

export function AuthLayout({
  children,
  kicker,
  wide = false,
  footer,
  brandHref = '/',
  brandTone = 'ops',
}: Props) {
  return (
    <div className="lte-login">
      <a className="skip-link" href="#conteudo">
        Ir para o conteudo
      </a>
      <div className={`lte-login__box${wide ? ' lte-login__box--wide' : ''}`}>
        <Brand href={brandHref} tone={brandTone} />
        {kicker ? <p className="lte-login__meta">{kicker}</p> : null}
        <main id="conteudo" className="lte-login__card">
          {children}
        </main>
        {footer ? <div className="lte-login__meta">{footer}</div> : null}
      </div>
    </div>
  );
}
