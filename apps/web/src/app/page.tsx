'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { APP_NAME, APP_PITCH, APP_TAGLINE } from '@gestao-epi/shared';
import Image from 'next/image';
import Link from 'next/link';
import { AppShell } from '../components/AppShell';
import { getAccessToken } from '../lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (getAccessToken()) {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <AppShell
      headerActions={
        <>
          <Link className="btn btn-ghost" href="/login">
            Entrar
          </Link>
          <Link className="btn btn-primary" href="/register">
            Comecar agora
          </Link>
        </>
      }
    >
      <section className="hero ux-enter">
        <div className="hero-copy">
          <p className="page-kicker">{APP_NAME}</p>
          <h1 className="hero-title">{APP_TAGLINE}</h1>
          <p className="hero-lead">{APP_PITCH}</p>
          <div className="btn-row">
            <Link className="btn btn-primary" href="/register">
              Criar minha consultoria
            </Link>
            <Link className="btn btn-secondary" href="/login">
              Ja tenho acesso
            </Link>
            <Link className="btn btn-ghost" href="/portal/login">
              Portal do cliente
            </Link>
          </div>
          <div className="status-pill" role="status">
            <span className="dot" aria-hidden="true" />
            Pronto para piloto com cliente real
          </div>
        </div>

        <aside className="hero-aside" aria-label="Por que ProntEPI">
          <Image
            src="/brand/prontepi-mark.png"
            alt=""
            width={64}
            height={64}
            style={{ borderRadius: '0.75rem', marginBottom: '0.75rem' }}
          />
          <h2>O que o mercado sente na pele</h2>
          <ul>
            <li>Implantacao clara: CNPJ, PGRO e portal</li>
            <li>Entrega com biometria e comprovante</li>
            <li>Mobile no chao de fabrica</li>
            <li>Rastreio NR-06 sem planilha</li>
          </ul>
        </aside>
      </section>
    </AppShell>
  );
}
