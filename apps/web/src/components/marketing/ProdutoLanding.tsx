'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { APP_NAME } from '@gestao-epi/shared';
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

type LeadStatus = 'idle' | 'sending' | 'sent';

const CONTACT_EMAIL = 'contato@prontepi.com.br';
const WEBSITE_URL = 'https://prontepi.com.br';
const SALES_WHATSAPP = process.env.NEXT_PUBLIC_SALES_WHATSAPP ?? '';

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

  async function onPrimaryCtaClick() {
    if (isPrimaryBusy) return;
    setIsPrimaryBusy(true);
    setFeedback('Preparando seu contato com o time comercial...');
    await new Promise((resolve) => setTimeout(resolve, 650));
    setIsPrimaryBusy(false);
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
          <a href="#beneficios">Beneficios</a>
          <a href="#como">Como funciona</a>
          <a href="#prova">Quem usa</a>
          <a href="#contato">Contato</a>
        </nav>
        <div className="produto-lp__nav-actions">
          <Link className="produto-lp__link-quiet" href="/login">
            Consultoria
          </Link>
          <button
            type="button"
            className="produto-lp__btn produto-lp__btn--solid"
            onClick={() => void onPrimaryCtaClick()}
            disabled={isPrimaryBusy}
            aria-busy={isPrimaryBusy}
          >
            {isPrimaryBusy ? 'Abrindo contato...' : 'Agendar demonstracao'}
          </button>
        </div>
      </header>

      <main>
        {/* 1. Hero — marca + 1 headline + 1 frase + CTAs (sem print) */}
        <section className="produto-lp__hero" aria-label="Apresentacao" data-reveal>
          <div className="produto-lp__hero-bg" aria-hidden="true" />
          <div className="produto-lp__hero-inner produto-lp__anim-in">
            <p className="produto-lp__brand-lock">
              <BrandMark className="produto-lp__brand-mark" title={APP_NAME} />
              <span className="produto-lp__brand-word">{APP_NAME}</span>
            </p>
            <h1 className="produto-lp__h1">
              Transforme sua
              <br />
              <span>gestao de EPI em vantagem operacional.</span>
            </h1>
            <p className="produto-lp__lead">
              Entrega com evidencia facial, controle de CA e estoque, alertas de validade e
              relatorios prontos para auditoria, no ritmo do chao de fabrica.
            </p>
            <div className="produto-lp__cta-row">
              <button
                type="button"
                className="produto-lp__btn produto-lp__btn--solid produto-lp__btn--lg"
                onClick={() => void onPrimaryCtaClick()}
                disabled={isPrimaryBusy}
                aria-busy={isPrimaryBusy}
              >
                {isPrimaryBusy ? 'Preparando contato...' : 'Quero ver uma demonstracao'}
              </button>
              <a className="produto-lp__btn produto-lp__btn--ghost produto-lp__btn--lg" href="#como">
                Ver como funciona
              </a>
            </div>
            <p className="produto-lp__hero-note">
              Dominio oficial: prontepi.com.br · Contato comercial: {CONTACT_EMAIL}
            </p>
          </div>
        </section>

        {/* Trust */}
        <section className="produto-lp__trust" aria-label="Contexto" data-reveal>
          <p>
            Feito para consultorias SST e empresas que precisam operar com velocidade, prova e
            conformidade no mesmo fluxo.
          </p>
        </section>

        {/* 2. Problema */}
        <section className="produto-lp__block" aria-labelledby="problema-title" data-reveal>
          <div className="produto-lp__wrap produto-lp__wrap--narrow">
            <p className="produto-lp__kicker">O problema</p>
            <h2 id="problema-title" className="produto-lp__h2">
              Entregar EPI sem rastreabilidade vira risco tecnico, juridico e operacional.
            </h2>
            <p className="produto-lp__text">
              Planilhas e controles paralelos nao sustentam operacao de alto volume. O custo aparece
              em retrabalho, troca atrasada e inseguranca quando a fiscalizacao exige evidencia.
            </p>
          </div>
        </section>

        <ProductBenefitsSection />
        <ProductStepsSection />
        <ProductQuotesSection />
        <ProductFaqSection />

        <section id="contato" className="produto-lp__block produto-lp__block--tint" data-reveal>
          <div className="produto-lp__wrap produto-lp__wrap--narrow">
            <p className="produto-lp__kicker">Contato comercial</p>
            <h2 className="produto-lp__h2">Fale com o time e veja uma demonstracao guiada</h2>
            <p className="produto-lp__text">
              Preencha os dados e abrimos seu e-mail com a mensagem pronta para {CONTACT_EMAIL}.
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
                  Falar no WhatsApp
                </button>
              ) : null}
              <p className="produto-lp__form-note">
                Site oficial: <a href={WEBSITE_URL}>{WEBSITE_URL}</a> · E-mail: {CONTACT_EMAIL}
              </p>
            </form>
          </div>
        </section>

        {/* 6. CTA final */}
        <section className="produto-lp__close" aria-labelledby="cta-title" data-reveal>
          <div className="produto-lp__close-inner produto-lp__anim-in">
            <BrandMark className="produto-lp__close-mark" title={APP_NAME} />
            <h2 id="cta-title" className="produto-lp__h2">
              Sua operacao pode sair da planilha agora
            </h2>
            <p className="produto-lp__text">
              O {APP_NAME} une implantacao tecnica da consultoria e rotina operacional da empresa
              em uma jornada simples, moderna e rastreavel.
            </p>
            <div className="produto-lp__cta-row produto-lp__cta-row--center">
              <button
                type="button"
                className="produto-lp__btn produto-lp__btn--solid produto-lp__btn--lg"
                onClick={() => void onPrimaryCtaClick()}
                disabled={isPrimaryBusy}
                aria-busy={isPrimaryBusy}
              >
                {isPrimaryBusy ? 'Abrindo contato...' : 'Quero conhecer o ProntEPI'}
              </button>
              <Link className="produto-lp__link-quiet" href="/login">
                Sou da consultoria
              </Link>
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
            {APP_NAME} · entrega com conformidade
          </span>
        </div>
        <div className="produto-lp__footer-links">
          <a href={withUtm(WEBSITE_URL, 'landing', 'footer', 'brand_access')}>Site</a>
          <Link href="/portal/login">Painel</Link>
          <Link href="/login">Consultoria</Link>
          <a href={`mailto:${CONTACT_EMAIL}`}>Contato</a>
        </div>
      </footer>
    </div>
  );
}
