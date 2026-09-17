'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { APP_FULL_NAME, APP_NAME } from '@gestao-epi/shared';
import { BrandMark } from '../BrandMark';
import { FormEvent, useEffect, useMemo, useState } from 'react';

const ProductBenefitsSection = dynamic(
  () => import('./ProductBenefitsSection').then((mod) => mod.ProductBenefitsSection),
  { loading: () => <SectionSkeleton cards={4} /> },
);
const ProductStepsSection = dynamic(
  () => import('./ProductStepsSection').then((mod) => mod.ProductStepsSection),
  { loading: () => <SectionSkeleton cards={3} /> },
);
const ProductQuotesSection = dynamic(
  () => import('./ProductQuotesSection').then((mod) => mod.ProductQuotesSection),
  { loading: () => <SectionSkeleton cards={3} dark /> },
);
const ProductFaqSection = dynamic(
  () => import('./ProductFaqSection').then((mod) => mod.ProductFaqSection),
  { loading: () => <SectionSkeleton cards={4} /> },
);
const ProductRealOperationSection = dynamic(
  () => import('./ProductRealOperationSection').then((mod) => mod.ProductRealOperationSection),
  { loading: () => <SectionSkeleton cards={2} dark /> },
);
const ProductCapabilitiesSection = dynamic(
  () => import('./ProductCapabilitiesSection').then((mod) => mod.ProductCapabilitiesSection),
  { loading: () => <SectionSkeleton cards={6} /> },
);

type LeadStatus = 'idle' | 'sending' | 'sent';

const CONTACT_EMAIL = 'contato@prontepi.com.br';
const WEBSITE_URL = 'https://prontepi.com.br';
const SALES_WHATSAPP = process.env.NEXT_PUBLIC_SALES_WHATSAPP ?? '5516996282630';
const SALES_WHATSAPP_DISPLAY = '(16) 99628-2630';

const PROOF_SEQUENCE = [
  'Diagnostico da operacao atual por CNPJ e processo',
  'Implantacao assistida com estrutura SST e regras de entrega',
  'Time cliente operando com evidencia e relatorios em producao',
] as const;

const OBJECTIONS = [
  {
    title: 'Nao quero travar a equipe com tecnologia',
    text: 'O fluxo foi feito para campo: rapido, guiado e com contingencia presencial.',
  },
  {
    title: 'Nem todo EPI do meu cliente tem CA',
    text: 'Sem problema. O sistema suporta EPI sem CA com entrada manual controlada.',
  },
  {
    title: 'Tenho medo da implantacao demorar',
    text: 'A proposta e implantacao objetiva em etapas curtas, sem parar a rotina.',
  },
] as const;

function normalizeWhatsAppPhone(value: string) {
  return value.replace(/\D/g, '');
}

function withUtm(url: string, source: string, medium: string, campaign: string) {
  const glue = url.includes('?') ? '&' : '?';
  return `${url}${glue}utm_source=${encodeURIComponent(source)}&utm_medium=${encodeURIComponent(
    medium,
  )}&utm_campaign=${encodeURIComponent(campaign)}`;
}

function SectionSkeleton({ cards, dark }: { cards: number; dark?: boolean }) {
  return (
    <section
      className={`produto-lp__block${dark ? ' produto-lp__block--navy' : ''}`}
      aria-label="Carregando secao"
    >
      <div className="produto-lp__wrap">
        <div className="produto-lp__skeleton produto-lp__skeleton--title" />
        <div className="produto-lp__skeleton produto-lp__skeleton--subtitle" />
        <div className="produto-lp__skeleton-grid">
          {Array.from({ length: cards }).map((_, index) => (
            <div key={`skeleton-${index}`} className="produto-lp__skeleton produto-lp__skeleton--card" />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Landing profissional do Painel do Cliente — conversao, marca e prova social. */
export function ProdutoLanding() {
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadStatus, setLeadStatus] = useState<LeadStatus>('idle');
  const [feedback, setFeedback] = useState('');
  const [isPrimaryBusy, setIsPrimaryBusy] = useState(false);

  const canSubmit = useMemo(() => {
    return leadName.trim().length >= 2 && leadPhone.trim().length >= 8 && leadStatus !== 'sending';
  }, [leadName, leadPhone, leadStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    );

    function registerRevealNode(node: Element) {
      if (!(node instanceof HTMLElement) || seen.has(node)) return;
      seen.add(node);
      if (prefersReduced) {
        node.classList.add('is-visible');
      } else {
        observer.observe(node);
      }
    }

    document.querySelectorAll('[data-reveal]').forEach(registerRevealNode);

    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((added) => {
          if (!(added instanceof Element)) return;
          if (added.hasAttribute('data-reveal')) registerRevealNode(added);
          added.querySelectorAll('[data-reveal]').forEach(registerRevealNode);
        });
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, []);

  function openDemoEmail() {
    const subject = encodeURIComponent('Quero agendar demonstracao do ProntEPI');
    const body = encodeURIComponent(
      `Nome: ${leadName || '-'}\nTelefone: ${leadPhone || '-'}\n\nQuero conhecer o ProntEPI para minha operacao.`,
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  }

  async function openDirectWhatsApp() {
    if (isPrimaryBusy) return;
    setIsPrimaryBusy(true);
    setFeedback('Abrindo WhatsApp do comercial...');
    const phone = normalizeWhatsAppPhone(SALES_WHATSAPP);
    const message = encodeURIComponent(
      'Oi! Quero uma demonstracao do ProntEPI e entender como implantar na minha operacao.',
    );
    await new Promise((resolve) => setTimeout(resolve, 320));
    window.open(
      withUtm(`https://wa.me/${phone}?text=${message}`, 'landing', 'cta', 'whatsapp_direto'),
      '_blank',
      'noopener,noreferrer',
    );
    setIsPrimaryBusy(false);
  }

  function openWhatsAppCta() {
    const phone = normalizeWhatsAppPhone(SALES_WHATSAPP);
    if (!phone) return;
    const message = encodeURIComponent(
      `Oi! Quero uma demonstracao do ProntEPI (${WEBSITE_URL}). Nome: ${leadName || '-'} | Telefone: ${leadPhone || '-'}`,
    );
    window.open(
      withUtm(`https://wa.me/${phone}?text=${message}`, 'landing', 'whatsapp', 'demo_prontepi'),
      '_blank',
      'noopener,noreferrer',
    );
  }

  async function onLeadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setLeadStatus('sending');
    setFeedback('Enviando seu pedido de contato...');
    await new Promise((resolve) => setTimeout(resolve, 900));
    setLeadStatus('sent');
    setFeedback('Pedido pronto. Abrindo seu e-mail para envio com 1 clique.');
    openDemoEmail();
  }

  return (
    <div className="produto-lp">
      <header className="produto-lp__nav">
        <Link href="/produto" className="produto-lp__nav-brand" aria-label={APP_NAME}>
          <BrandMark className="produto-lp__nav-mark" title={APP_NAME} />
          <span>{APP_NAME}</span>
        </Link>
        <nav className="produto-lp__nav-links" aria-label="Secoes">
          <a href="#oferta">Oferta</a>
          <a href="#prova-sequencia">Prova em sequencia</a>
          <a href="#real">Sistema real</a>
          <a href="#beneficios">Beneficios</a>
          <a href="#capabilities">Funcoes</a>
          <a href="#como">Como funciona</a>
          <a href="#prova">Quem usa</a>
          <a href="#contato">Contato</a>
        </nav>
        <div className="produto-lp__nav-actions">
          <button
            type="button"
            className="produto-lp__btn produto-lp__btn--solid"
            onClick={() => void openDirectWhatsApp()}
            disabled={isPrimaryBusy}
            aria-busy={isPrimaryBusy}
          >
            {isPrimaryBusy ? 'Abrindo contato...' : 'Falar no WhatsApp'}
          </button>
        </div>
      </header>

      <main>
        <section className="produto-lp__hero" aria-label="Apresentacao" data-reveal>
          <div className="produto-lp__hero-bg" aria-hidden="true" />
          <div className="produto-lp__hero-grid">
            <div className="produto-lp__hero-inner produto-lp__anim-in">
              <p className="produto-lp__brand-lock">
                <BrandMark className="produto-lp__brand-mark" title={APP_NAME} />
                <span className="produto-lp__brand-word">{APP_NAME}</span>
              </p>
              <h1 className="produto-lp__h1">
                Entregue EPI com
                <br />
                <span>prova real e sem gargalo operacional.</span>
              </h1>
              <p className="produto-lp__lead">
                {APP_FULL_NAME} conecta estoque, assinatura, evidencias e conformidade em um fluxo
                rapido para consultorias e empresas.
              </p>
              <div className="produto-lp__cta-row">
                <button
                  type="button"
                  className="produto-lp__btn produto-lp__btn--solid produto-lp__btn--lg"
                  onClick={() => void openDirectWhatsApp()}
                  disabled={isPrimaryBusy}
                  aria-busy={isPrimaryBusy}
                >
                  Quero uma demo no WhatsApp
                </button>
                <a
                  className="produto-lp__btn produto-lp__btn--ghost produto-lp__btn--lg"
                  href="#real"
                >
                  Ver sistema operando
                </a>
              </div>
              <p className="produto-lp__hero-note">
                Contato direto: (16) 99628-2630 · {CONTACT_EMAIL}
              </p>
            </div>

            <aside className="produto-lp__hero-panel produto-lp__card">
              <p className="produto-lp__hero-panel-title">Resultado que importa</p>
              <ul className="produto-lp__hero-kpis">
                <li>
                  <strong>Entrega com evidencia</strong>
                  <span>Facial presencial ou assinatura por link no celular.</span>
                </li>
                <li>
                  <strong>Estoque sob controle</strong>
                  <span>CA, validade, saldo por local e rastreabilidade de entrada/saida.</span>
                </li>
                <li>
                  <strong>Pronto para auditoria</strong>
                  <span>Comprovantes, ficha de EPI e relatorios em poucos cliques.</span>
                </li>
              </ul>
            </aside>
          </div>
        </section>

        <section className="produto-lp__trust" aria-label="Contexto" data-reveal>
          <p>
            Feito para consultorias SST e empresas com operacao real de EPI: industria, obra,
            manutencao, logistica e servicos de campo.
          </p>
        </section>

        <section id="oferta" className="produto-lp__block" data-reveal>
          <div className="produto-lp__wrap">
            <div className="produto-lp__offer produto-lp__card">
              <p className="produto-lp__kicker">Oferta de implantacao</p>
              <h2 className="produto-lp__h2">Implantacao orientada para operar rapido e vender melhor</h2>
              <p className="produto-lp__text">
                Voce entra com os dados da operacao e o time do ProntEPI guia a virada para processo
                digital com evidencia forte, sem depender de planilhas.
              </p>
              <div className="produto-lp__cta-row">
                <button
                  type="button"
                  className="produto-lp__btn produto-lp__btn--solid produto-lp__btn--lg"
                  onClick={() => void openDirectWhatsApp()}
                  disabled={isPrimaryBusy}
                  aria-busy={isPrimaryBusy}
                >
                  Quero analisar meu cenario
                </button>
                <a className="produto-lp__btn produto-lp__btn--line produto-lp__btn--lg" href="#contato">
                  Receber proposta comercial
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="prova-sequencia" className="produto-lp__block produto-lp__block--tint" data-reveal>
          <div className="produto-lp__wrap">
            <p className="produto-lp__kicker">Prova em sequencia</p>
            <h2 className="produto-lp__h2">Como o cliente sai do caos para controle operacional</h2>
            <ol className="produto-lp__proof-seq">
              {PROOF_SEQUENCE.map((item, index) => (
                <li key={item} className="produto-lp__card">
                  <span>Passo {index + 1}</span>
                  <p>{item}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="produto-lp__block" aria-labelledby="problema-title" data-reveal>
          <div className="produto-lp__wrap produto-lp__wrap--narrow">
            <p className="produto-lp__kicker">O problema</p>
            <h2 id="problema-title" className="produto-lp__h2">
              Sem processo unico, sua equipe perde tempo e sua evidencia perde forca.
            </h2>
            <p className="produto-lp__text">
              O que parece detalhe vira prejuizo: entrega sem prova, troca atrasada, CA sem
              conferencia e auditoria consumindo energia do time inteiro.
            </p>
          </div>
        </section>

        <section id="real">
          <ProductRealOperationSection />
        </section>
        <ProductBenefitsSection />
        <section id="capabilities">
          <ProductCapabilitiesSection />
        </section>
        <ProductStepsSection />

        <section className="produto-lp__block" data-reveal>
          <div className="produto-lp__wrap">
            <p className="produto-lp__kicker">Objeções mais comuns</p>
            <h2 className="produto-lp__h2">Sem surpresa na implantacao e na operacao</h2>
            <div className="produto-lp__objections">
              {OBJECTIONS.map((item) => (
                <article key={item.title} className="produto-lp__card produto-lp__objection">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <ProductQuotesSection />
        <ProductFaqSection />

        <section id="contato" className="produto-lp__block produto-lp__block--tint" data-reveal>
          <div className="produto-lp__wrap produto-lp__wrap--narrow">
            <p className="produto-lp__kicker">Contato comercial</p>
            <h2 className="produto-lp__h2">Fale com o time e veja uma demonstracao guiada</h2>
            <p className="produto-lp__text">
              Preencha os dados ou chame agora no WhatsApp para entender implantacao, prazo e
              investimento.
            </p>
            <form className="produto-lp__lead-form produto-lp__card" onSubmit={onLeadSubmit}>
              <label>
                <span>Nome</span>
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={leadName}
                  onChange={(event) => setLeadName(event.target.value)}
                  required
                  minLength={2}
                />
              </label>
              <label>
                <span>Telefone/WhatsApp</span>
                <input
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={leadPhone}
                  onChange={(event) => setLeadPhone(event.target.value)}
                  required
                  minLength={8}
                />
              </label>
              <button
                type="submit"
                className="produto-lp__btn produto-lp__btn--solid produto-lp__btn--lg"
                disabled={!canSubmit}
                aria-busy={leadStatus === 'sending'}
              >
                {leadStatus === 'sending' ? 'Preparando seu contato...' : 'Agendar demonstracao'}
              </button>
              {SALES_WHATSAPP ? (
                <button
                  type="button"
                  className="produto-lp__btn produto-lp__btn--ghost produto-lp__btn--lg produto-lp__btn--line"
                  onClick={openWhatsAppCta}
                >
                  Chamar no WhatsApp agora
                </button>
              ) : null}
              <p className="produto-lp__form-note">
                Site: <a href={WEBSITE_URL}>{WEBSITE_URL}</a> · WhatsApp: {SALES_WHATSAPP_DISPLAY} · E-mail:{' '}
                {CONTACT_EMAIL}
              </p>
            </form>
          </div>
        </section>

        <section className="produto-lp__close" aria-labelledby="cta-title" data-reveal>
          <div className="produto-lp__close-inner produto-lp__anim-in">
            <BrandMark className="produto-lp__close-mark" title={APP_NAME} />
            <h2 id="cta-title" className="produto-lp__h2">
              Pronto para implantar uma operacao de EPI mais forte?
            </h2>
            <p className="produto-lp__text">
              Fale com o comercial e veja como aplicar o ProntEPI no seu contexto com plano de
              implantacao objetivo.
            </p>
            <div className="produto-lp__cta-row produto-lp__cta-row--center">
              <button
                type="button"
                className="produto-lp__btn produto-lp__btn--solid produto-lp__btn--lg"
                onClick={() => void openDirectWhatsApp()}
                disabled={isPrimaryBusy}
                aria-busy={isPrimaryBusy}
              >
                {isPrimaryBusy ? 'Abrindo contato...' : 'Quero implantar agora'}
              </button>
            </div>
            {feedback ? (
              <p className="produto-lp__feedback" role="status">
                {feedback}
              </p>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="produto-lp__footer">
        <div className="produto-lp__footer-brand">
          <BrandMark className="produto-lp__footer-mark" title={APP_NAME} />
          <span>
            {APP_FULL_NAME}
          </span>
        </div>
        <div className="produto-lp__footer-links">
          <a href={withUtm(WEBSITE_URL, 'landing', 'footer', 'brand_access')}>Site</a>
          <Link href="/portal/login">Painel</Link>
          <a href={`mailto:${CONTACT_EMAIL}`}>Contato</a>
        </div>
      </footer>

      <div className="produto-lp__mobile-cta">
        <button
          type="button"
          className="produto-lp__btn produto-lp__btn--solid"
          onClick={() => void openDirectWhatsApp()}
          disabled={isPrimaryBusy}
          aria-busy={isPrimaryBusy}
        >
          {isPrimaryBusy ? 'Abrindo...' : 'WhatsApp comercial'}
        </button>
      </div>
    </div>
  );
}
