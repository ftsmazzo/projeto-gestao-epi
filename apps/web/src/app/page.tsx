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
      <section className="hero">
        <div className="hero-copy">
          <p className="page-kicker">Web Admin</p>
          <h1 className="hero-title">{APP_NAME}</h1>
          <p className="hero-lead">
            Controle operacional de entrega de EPI para a empresa usuaria:
            clientes atendidos, vidas, estoque, documentos e relatorios.
          </p>
          <div className="btn-row">
            <Link className="btn btn-primary" href="/register">
              Registrar organizacao
            </Link>
            <Link className="btn btn-secondary" href="/login">
              Ja tenho acesso
            </Link>
          </div>
          <div className="status-pill" role="status">
            <span className="dot" aria-hidden="true" />
            Autenticacao e tenancy ativos
          </div>
        </div>

        <aside className="hero-aside" aria-label="Escopo atual">
          <h2>Escopo operacional</h2>
          <ul>
            <li>Tenant = empresa que assina o software</li>
            <li>Clientes atendidos com cotas de vidas</li>
            <li>Portal do cliente em etapa futura</li>
            <li>Cadastros e entrega nas proximas subetapas</li>
          </ul>
        </aside>
      </section>
    </AppShell>
  );
}
