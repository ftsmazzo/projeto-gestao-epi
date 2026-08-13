import Link from 'next/link';
import { APP_NAME } from '@gestao-epi/shared';
import { BrandMark } from '../BrandMark';

const BENEFITS = [
  {
    title: 'Entrega com prova',
    text: 'Trabalhador, EPI e biometria no mesmo fluxo. O recibo sai pronto — sem papel solto na gaveta.',
  },
  {
    title: 'CA que nao mente',
    text: 'O estoque da empresa bloqueia CA incompativel e avisa validade antes da auditoria perguntar.',
  },
  {
    title: 'Fila do que importa',
    text: 'Troca vencida, sem face, CA fora do prazo: o Painel mostra o que precisa de decisao agora.',
  },
  {
    title: 'Relatorio na hora',
    text: 'Visao geral, trocas e cobertura. Filtre o periodo, exporte CSV ou imprima quando pedirem.',
  },
] as const;

const STEPS = [
  {
    n: '01',
    title: 'Entre no Painel',
    text: 'Acesso da empresa — nao e a tela da consultoria. Menu no topo, operacao no centro.',
  },
  {
    n: '02',
    title: 'Opere o dia a dia',
    text: 'Entrega, estoque, validade e trabalhadores no mesmo lugar. Sem planilha paralela.',
  },
  {
    n: '03',
    title: 'Feche com evidencia',
    text: 'Recibo, ficha e relatorio quando a auditoria ou a SST pedir — em minutos, nao em dias.',
  },
] as const;

const QUOTES = [
  {
    quote:
      'Antes a gente corria atras de planilha na hora da fiscalizacao. Agora abro o Painel e mostro a entrega com a face na hora.',
    name: 'Camila R.',
    role: 'Gestora de SST · industria metalurgica',
  },
  {
    quote:
      'O operador no patio entrega pelo celular. Eu so olho o que esta vermelho: troca, CA, biometria pendente.',
    name: 'Rodrigo M.',
    role: 'Tecnico de seguranca · obra e manutencao',
  },
  {
    quote:
      'A consultoria configura o PGR. A gente vive o dia a dia no Painel. Cada um no seu login — acabou a confusao.',
    name: 'Patricia L.',
    role: 'Gerente de operacoes · multiplas unidades',
  },
] as const;

/** Landing profissional do Painel do Cliente — conversao, marca e prova social. */
export function ProdutoLanding() {
  return (
    <div className="produto-lp">
      <header className="produto-lp__nav">
        <Link href="/produto" className="produto-lp__nav-brand" aria-label={APP_NAME}>
          <BrandMark className="produto-lp__nav-mark" title={APP_NAME} />
          <span>{APP_NAME}</span>
        </Link>
        <nav className="produto-lp__nav-links" aria-label="Secoes">
          <a href="#como">Como funciona</a>
          <a href="#prova">Quem usa</a>
        </nav>
        <div className="produto-lp__nav-actions">
          <Link className="produto-lp__link-quiet" href="/login">
            Consultoria
          </Link>
          <Link className="produto-lp__btn produto-lp__btn--solid" href="/portal/login">
            Entrar no Painel
          </Link>
        </div>
      </header>

      <main>
        {/* 1. Hero — marca + 1 headline + 1 frase + CTAs (sem print) */}
        <section className="produto-lp__hero" aria-label="Apresentacao">
          <div className="produto-lp__hero-bg" aria-hidden="true" />
          <div className="produto-lp__hero-inner produto-lp__anim-in">
            <p className="produto-lp__brand-lock">
              <BrandMark className="produto-lp__brand-mark" title={APP_NAME} />
              <span className="produto-lp__brand-word">{APP_NAME}</span>
            </p>
            <h1 className="produto-lp__h1">
              Pare de gerir EPI
              <br />
              <span>na planilha.</span>
            </h1>
            <p className="produto-lp__lead">
              O Painel do Cliente coloca entrega facial, estoque com CA certo e alertas
              NR-06 no ritmo do chao de fabrica.
            </p>
            <div className="produto-lp__cta-row">
              <Link
                className="produto-lp__btn produto-lp__btn--solid produto-lp__btn--lg"
                href="/portal/login"
              >
                Entrar no Painel
              </Link>
              <a className="produto-lp__btn produto-lp__btn--ghost produto-lp__btn--lg" href="#como">
                Ver como funciona
              </a>
            </div>
            <p className="produto-lp__hero-note">
              Para gestores e operadores da empresa · Acesso separado da consultoria
            </p>
          </div>
        </section>

        {/* Trust */}
        <section className="produto-lp__trust" aria-label="Contexto">
          <p>
            Feito para empresas atendidas por consultoria de SST — operacao no Painel,
            implantacao na consultoria.
          </p>
        </section>

        {/* 2. Problema */}
        <section className="produto-lp__block" aria-labelledby="problema-title">
          <div className="produto-lp__wrap produto-lp__wrap--narrow">
            <p className="produto-lp__kicker">O problema</p>
            <h2 id="problema-title" className="produto-lp__h2">
              Troca vencida. CA errado. Auditoria na porta. Planilha aberta em tres abas.
            </h2>
            <p className="produto-lp__text">
              Quem vive o dia a dia sabe: o risco nao e so o EPI faltando — e nao
              conseguir provar que entregou certo, na hora certa, para a pessoa certa.
            </p>
          </div>
        </section>

        {/* 3. Beneficios */}
        <section
          id="beneficios"
          className="produto-lp__block produto-lp__block--tint"
          aria-labelledby="beneficios-title"
        >
          <div className="produto-lp__wrap">
            <p className="produto-lp__kicker">O Painel resolve</p>
            <h2 id="beneficios-title" className="produto-lp__h2">
              Quatro coisas que a planilha nunca fez bem
            </h2>
            <ul className="produto-lp__benefits">
              {BENEFITS.map((item) => (
                <li key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 4. Como funciona */}
        <section id="como" className="produto-lp__block" aria-labelledby="como-title">
          <div className="produto-lp__wrap">
            <p className="produto-lp__kicker">Como funciona</p>
            <h2 id="como-title" className="produto-lp__h2">
              Tres passos. Sem treinamento de um mes.
            </h2>
            <ol className="produto-lp__steps">
              {STEPS.map((step) => (
                <li key={step.n}>
                  <span className="produto-lp__step-n" aria-hidden="true">
                    {step.n}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5. Depoimentos */}
        <section
          id="prova"
          className="produto-lp__block produto-lp__block--navy"
          aria-labelledby="prova-title"
        >
          <div className="produto-lp__wrap">
            <p className="produto-lp__kicker produto-lp__kicker--on-dark">Prova social</p>
            <h2 id="prova-title" className="produto-lp__h2 produto-lp__h2--on-dark">
              Quem opera no chao fala assim
            </h2>
            <div className="produto-lp__quotes">
              {QUOTES.map((item) => (
                <blockquote key={item.name} className="produto-lp__quote">
                  <p>“{item.quote}”</p>
                  <footer>
                    <strong>{item.name}</strong>
                    <span>{item.role}</span>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* 6. CTA final */}
        <section className="produto-lp__close" aria-labelledby="cta-title">
          <div className="produto-lp__close-inner produto-lp__anim-in">
            <BrandMark className="produto-lp__close-mark" title={APP_NAME} />
            <h2 id="cta-title" className="produto-lp__h2">
              Seu time ja pode operar no Painel
            </h2>
            <p className="produto-lp__text">
              Entre com o e-mail da empresa. Se ainda nao tem acesso, fale com a
              consultoria InSeg que implantou o {APP_NAME}.
            </p>
            <div className="produto-lp__cta-row produto-lp__cta-row--center">
              <Link
                className="produto-lp__btn produto-lp__btn--solid produto-lp__btn--lg"
                href="/portal/login"
              >
                Entrar no Painel
              </Link>
              <Link className="produto-lp__link-quiet" href="/login">
                Sou da consultoria
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="produto-lp__footer">
        <div className="produto-lp__footer-brand">
          <BrandMark className="produto-lp__footer-mark" title={APP_NAME} />
          <span>
            {APP_NAME} · entrega com conformidade
          </span>
        </div>
        <div className="produto-lp__footer-links">
          <Link href="/portal/login">Painel</Link>
          <Link href="/login">Consultoria</Link>
          <Link href="/">Inicio</Link>
        </div>
      </footer>
    </div>
  );
}
