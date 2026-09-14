'use client';

import { useEffect, useMemo, useState } from 'react';

const QUOTES = [
  {
    quote:
      'A entrega ficou mais rapida e a evidencia ficou mais forte. Na auditoria, eu mostro tudo em minutos.',
    name: 'Camila R.',
    role: 'Gestora de SST',
  },
  {
    quote:
      'Hoje o time age por prioridade real. Vemos validade, troca e pendencia no mesmo painel.',
    name: 'Rodrigo M.',
    role: 'Tecnico de seguranca',
  },
  {
    quote:
      'A consultoria implanta e a empresa opera com autonomia. Menos retrabalho e mais controle diario.',
    name: 'Patricia L.',
    role: 'Gerente de operacoes',
  },
] as const;

export function ProductQuotesSection() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const prefersReduced = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (paused || prefersReduced) return;
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % QUOTES.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, [paused, prefersReduced]);

  return (
    <section
      id="prova"
      className="produto-lp__block produto-lp__block--navy"
      aria-labelledby="prova-title"
      data-reveal
    >
      <div className="produto-lp__wrap">
        <p className="produto-lp__kicker produto-lp__kicker--on-dark">Prova social</p>
        <h2 id="prova-title" className="produto-lp__h2 produto-lp__h2--on-dark">
          Quem opera EPI no dia a dia aprova
        </h2>
        <div
          className="produto-lp__quotes-carousel"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {QUOTES.map((item, index) => (
            <blockquote
              key={item.name}
              className={`produto-lp__quote produto-lp__card ${
                index === active ? 'is-active' : 'is-hidden'
              }`}
              aria-hidden={index !== active}
            >
              <p>"{item.quote}"</p>
              <footer>
                <strong>{item.name}</strong>
                <span>{item.role}</span>
              </footer>
            </blockquote>
          ))}
          <div className="produto-lp__quotes-nav" aria-label="Selecionar depoimento">
            {QUOTES.map((item, index) => (
              <button
                key={`${item.name}-${index}`}
                type="button"
                className={`produto-lp__dot${index === active ? ' is-active' : ''}`}
                aria-label={`Ver depoimento ${index + 1}`}
                aria-pressed={index === active}
                onClick={() => setActive(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
