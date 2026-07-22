import { APP_NAME } from '@gestao-epi/shared';
import Link from 'next/link';
import { AppShell } from '../components/AppShell';

export default function HomePage() {
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
            Plataforma operacional para entregar, rastrear e auditar EPIs com
            ficha eletronica, controle de vidas e isolamento por empresa
            usuaria.
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

        <aside className="hero-aside" aria-label="Proximos passos">
          <h2>Base pronta para operacao</h2>
          <ul>
            <li>Empresa usuaria (tenant) isolada por organizacao</li>
            <li>Login seguro com sessao JWT</li>
            <li>Franquia total de vidas preparada no cadastro</li>
            <li>Cadastros, estoque e entrega nas proximas etapas</li>
          </ul>
        </aside>
      </section>
    </AppShell>
  );
}
