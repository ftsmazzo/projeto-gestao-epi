import { APP_NAME } from '@gestao-epi/shared';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <section className="panel">
        <p className="eyebrow">Gestao de EPI</p>
        <h1>{APP_NAME}</h1>
        <p>
          Fundacao tecnica pronta com autenticacao e tenancy inicial. Cadastre a
          empresa usuaria (tenant) para acessar o dashboard.
        </p>
        <div className="actions">
          <Link className="button-link" href="/register">
            Registrar organizacao
          </Link>
          <Link href="/login">Entrar</Link>
        </div>
        <div className="status">
          <span className="dot" aria-hidden="true" />
          Auth e tenancy disponiveis
        </div>
      </section>
    </main>
  );
}
