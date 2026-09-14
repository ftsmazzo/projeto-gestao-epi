'use client';

import Image from 'next/image';
import { useState } from 'react';

export function ProductRealOperationSection() {
  const [playing, setPlaying] = useState(false);
  const waLink =
    'https://wa.me/5516996282630?text=Oi!%20Vi%20o%20video%20do%20ProntEPI%20e%20quero%20uma%20demo%20completa.';

  return (
    <section className="produto-lp__block produto-lp__block--ink" aria-labelledby="real-title" data-reveal>
      <div className="produto-lp__wrap">
        <div className="produto-lp__media-layout">
          <div>
            <p className="produto-lp__kicker produto-lp__kicker--on-dark">Sistema em operacao real</p>
            <h2 id="real-title" className="produto-lp__h2 produto-lp__h2--on-dark">
              Nao e mock: e tela do ProntEPI rodando no fluxo do cliente
            </h2>
            <p className="produto-lp__text produto-lp__text--on-dark">
              Corte real de 12 segundos com navegacao no modulo de validade e indicadores coloridos
              de criticidade. Sem mock e sem tela inventada.
            </p>
            <ul className="produto-lp__real-bullets">
              <li>Operacao por prioridade com foco no que esta vencendo</li>
              <li>Visao unica de validade, estoque e cobertura por funcao</li>
              <li>Base pronta para decisao rapida em auditoria</li>
            </ul>
          </div>

          <div className="produto-lp__media-card produto-lp__card">
            <video
              className="produto-lp__video"
              controls
              preload="metadata"
              poster="/branding/screens/operacao-real-poster.jpg"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            >
              <source src="/branding/screens/operacao-real-corte.mp4" type="video/mp4" />
              Seu navegador nao suporta video incorporado.
            </video>
            <div className="produto-lp__media-caption">
              <span>{playing ? 'Reproduzindo agora' : 'Assistir demonstracao real (12s)'}</span>
              <span>Trecho retirado do video operacional</span>
            </div>
            <a className="produto-lp__btn produto-lp__btn--solid" href={waLink} target="_blank" rel="noreferrer">
              Quero a demo completa no WhatsApp
            </a>
          </div>
        </div>

        <div className="produto-lp__real-gallery">
          <figure className="produto-lp__real-shot produto-lp__card">
            <Image
              src="/branding/screens/sistema-shot-1.jpg"
              alt="Tela real de configuracoes da consultoria no ProntEPI"
              width={1440}
              height={810}
              sizes="(max-width: 980px) 100vw, 32vw"
            />
            <figcaption>Configuracoes e governanca da consultoria</figcaption>
          </figure>
          <figure className="produto-lp__real-shot produto-lp__card">
            <Image
              src="/branding/screens/sistema-shot-2.jpg"
              alt="Tela real de validade de EPI com indicadores coloridos"
              width={1440}
              height={810}
              sizes="(max-width: 980px) 100vw, 32vw"
            />
            <figcaption>Painel de validade com prioridades visuais</figcaption>
          </figure>
          <figure className="produto-lp__real-shot produto-lp__card">
            <Image
              src="/branding/screens/sistema-shot-3.jpg"
              alt="Tela real da ficha de EPI com rastreabilidade"
              width={1440}
              height={810}
              sizes="(max-width: 980px) 100vw, 32vw"
            />
            <figcaption>Ficha de EPI e comprovacao documental</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
