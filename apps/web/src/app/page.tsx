'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { APP_NAME } from '@gestao-epi/shared';
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
            Criar organizacao
          </Link>
        </>
      }
    >
      <section className="hero ux-enter">
        <div className="hero-copy">
          <p className="page-kicker">Gestao digital de EPI</p>
          <h1 className="hero-title">{APP_NAME}</h1>
          <p className="hero-lead">
            A consultoria implanta o cliente. A empresa opera entregas com
            biometria, estoque e conformidade NR-06 — no desktop e no celular.
          </p>
          <div className="btn-row">
            <Link className="btn btn-primary" href="/register">
              Registrar organizacao
            </Link>
            <Link className="btn btn-secondary" href="/login">
              Entrar na consultoria
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

        <aside className="hero-aside" aria-label="Como funciona">
          <h2>Duas superficies, um fluxo</h2>
          <ul>
            <li>Consultoria: CNPJ, PGRO, estrutura e usuarios</li>
            <li>Portal: estoque, entrega facial e ficha</li>
            <li>Mobile-first no painel operacional</li>
            <li>Rastreio e comprovante em cada entrega</li>
          </ul>
        </aside>
      </section>
    </AppShell>
  );
}
