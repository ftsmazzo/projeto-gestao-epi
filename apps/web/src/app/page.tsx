import { APP_NAME } from '@gestao-epi/shared';

export default function HomePage() {
  return (
    <main>
      <section className="panel">
        <p className="eyebrow">Bootstrap tecnico</p>
        <h1>{APP_NAME}</h1>
        <p>
          O monorepo subiu com sucesso. Esta e a tela inicial do web admin.
          Autenticacao, cadastros e regras de negocio serao implementados nas
          proximas subetapas.
        </p>
        <div className="status">
          <span className="dot" aria-hidden="true" />
          Projeto operacional localmente
        </div>
      </section>
    </main>
  );
}
