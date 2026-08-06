import Link from 'next/link';
import { APP_NAME } from '@gestao-epi/shared';
import { BrandMark } from '../BrandMark';

/** Landing de marketing do Painel do Cliente (sem faces nem fichas pessoais). */
export function ProdutoLanding() {
  return (
    <div className="produto-lp">
      <header className="produto-lp__nav">
        <Link href="/produto" className="produto-lp__nav-brand" aria-label={APP_NAME}>
          <BrandMark className="produto-lp__nav-mark" title={APP_NAME} />
          <span>{APP_NAME}</span>
        </Link>
        <div className="produto-lp__nav-actions">
          <Link className="produto-lp__link-quiet" href="/login">
            Sou consultoria
          </Link>
          <Link className="produto-lp__btn produto-lp__btn--solid" href="/portal/login">
            Entrar no Painel
          </Link>
        </div>
      </header>

      <main>
        <section className="produto-lp__hero" aria-label="Apresentacao">
          <div className="produto-lp__hero-atmosphere" aria-hidden="true" />
          <div className="produto-lp__hero-grid" aria-hidden="true" />

          <div className="produto-lp__hero-copy produto-lp__reveal">
            <p className="produto-lp__brand-hero">
              <BrandMark className="produto-lp__brand-mark" title={APP_NAME} />
              <span className="produto-lp__brand-name">{APP_NAME}</span>
            </p>
            <h1 className="produto-lp__headline">
              EPI sob controle.
              <br />
              <em>Sem planilha.</em>
            </h1>
            <p className="produto-lp__lead">
              O Painel do Cliente organiza entrega, estoque e validade no ritmo da
              operacao — com conformidade NR-06.
            </p>
            <div className="produto-lp__cta-row">
              <Link
                className="produto-lp__btn produto-lp__btn--solid produto-lp__btn--lg"
                href="/portal/login"
              >
                Entrar no Painel
              </Link>
              <Link className="produto-lp__btn produto-lp__btn--ghost produto-lp__btn--lg" href="#estoque">
                Ver o produto
              </Link>
            </div>
          </div>

          <div className="produto-lp__hero-media produto-lp__reveal produto-lp__reveal--late">
            {/* Crop esconde barra com nome de usuario; sem faces/fichas */}
            <div className="produto-lp__shot produto-lp__shot--hero">
              <img
                src="/marketing/painel.png"
                alt="Painel do Cliente ProntEPI com alertas operacionais e atalhos"
                width={1600}
                height={1000}
                decoding="async"
              />
            </div>
          </div>
        </section>

        <section className="produto-lp__section produto-lp__section--pain" aria-labelledby="dor-title">
          <div className="produto-lp__narrow">
            <p className="produto-lp__eyebrow">A dor</p>
            <h2 id="dor-title" className="produto-lp__h2">
              Troca vencida, CA errado e auditoria pedindo comprovante — tudo no mesmo dia.
            </h2>
            <p className="produto-lp__body">
              Planilha nao acompanha o chao de fabrica. O Painel mostra o que precisa de
              atencao agora e guia o proximo passo.
            </p>
          </div>
        </section>

        <section
          id="entrega"
          className="produto-lp__section produto-lp__section--split"
          aria-labelledby="entrega-title"
        >
          <div className="produto-lp__split-copy">
            <p className="produto-lp__eyebrow">Entrega</p>
            <h2 id="entrega-title" className="produto-lp__h2">
              Entrega no ritmo da operacao
            </h2>
            <p className="produto-lp__body">
              Trabalhador, EPIs e confirmacao com biometria — baixa no estoque e recibo
              sem voltar para o papel.
            </p>
          </div>
          <div className="produto-lp__shot produto-lp__shot--bleed produto-lp__shot--flow">
            <img
              src="/marketing/entregas.png"
              alt="Fluxo de entrega de EPI em tres etapas no Painel do Cliente"
              width={1400}
              height={900}
              loading="lazy"
              decoding="async"
            />
          </div>
        </section>

        <section
          id="estoque"
          className="produto-lp__section produto-lp__section--split produto-lp__section--split-rev"
          aria-labelledby="estoque-title"
        >
          <div className="produto-lp__split-copy">
            <p className="produto-lp__eyebrow">Estoque e CA</p>
            <h2 id="estoque-title" className="produto-lp__h2">
              CA certo. Saldo certo.
            </h2>
            <p className="produto-lp__body">
              Entrada pela necessidade da funcao, bloqueio de CA incompativel e alertas
              de validade no estoque da empresa.
            </p>
          </div>
          <div className="produto-lp__shot-stack">
            <div className="produto-lp__shot produto-lp__shot--bleed">
              <img
                src="/marketing/estoque.png"
                alt="Estoque do Painel com necessidades e entrada por CAEPI"
                width={1400}
                height={900}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="produto-lp__shot produto-lp__shot--bleed produto-lp__shot--secondary">
              <img
                src="/marketing/validade.png"
                alt="Validade de CA com itens vencidos e em dia"
                width={1400}
                height={900}
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </section>

        <section
          id="relatorios"
          className="produto-lp__section produto-lp__section--split"
          aria-labelledby="relatorios-title"
        >
          <div className="produto-lp__split-copy">
            <p className="produto-lp__eyebrow">Relatorios</p>
            <h2 id="relatorios-title" className="produto-lp__h2">
              Leitura operacional, pronta para exportar
            </h2>
            <p className="produto-lp__body">
              Visao geral, trocas, entregas e cobertura — filtre o periodo e exporte CSV
              ou imprima quando a auditoria pedir.
            </p>
          </div>
          <div className="produto-lp__shot produto-lp__shot--bleed">
            <img
              src="/marketing/relatorios.png"
              alt="Relatorios do Painel do Cliente com visao geral"
              width={1400}
              height={900}
              loading="lazy"
              decoding="async"
            />
          </div>
        </section>

        <section
          id="mobile"
          className="produto-lp__section produto-lp__section--mobile"
          aria-labelledby="mobile-title"
        >
          <div className="produto-lp__mobile-copy">
            <p className="produto-lp__eyebrow">No celular</p>
            <h2 id="mobile-title" className="produto-lp__h2">
              No chao de fabrica, no bolso
            </h2>
            <p className="produto-lp__body">
              Atalhos de entrega, estoque e alertas na barra inferior — sem perder o fio
              da operacao.
            </p>
          </div>
          <div className="produto-lp__mobile-stage">
            <div className="produto-lp__shot produto-lp__shot--phone">
              <img
                src="/marketing/painel-mobile.png"
                alt="Painel do Cliente no celular"
                width={900}
                height={1600}
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </section>

        <section className="produto-lp__section produto-lp__section--close" aria-labelledby="close-title">
          <div className="produto-lp__close-inner">
            <BrandMark className="produto-lp__close-mark" title={APP_NAME} />
            <h2 id="close-title" className="produto-lp__h2">
              Pronto para o dia a dia da empresa
            </h2>
            <p className="produto-lp__body">
              Entre no Painel do Cliente e veja o {APP_NAME} no ritmo da sua operacao.
            </p>
            <div className="produto-lp__cta-row produto-lp__cta-row--center">
              <Link
                className="produto-lp__btn produto-lp__btn--solid produto-lp__btn--lg"
                href="/portal/login"
              >
                Entrar no Painel
              </Link>
              <Link className="produto-lp__link-quiet" href="/login">
                Acesso da consultoria
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="produto-lp__footer">
        <span>
          {APP_NAME} · Painel do Cliente
        </span>
        <Link href="/">Inicio</Link>
      </footer>
    </div>
  );
}
