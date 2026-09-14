'use client';

import Image from 'next/image';
import { useState } from 'react';

export function ProductRealOperationSection() {
  const [playing, setPlaying] = useState(false);

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
              Corte curto com operacao de estoque e entrega em contexto real. A proposta e simples:
              reduzir retrabalho e aumentar prova operacional na rotina.
            </p>
            <ul className="produto-lp__real-bullets">
              <li>Fluxo de estoque com entrada por CA e operacao guiada</li>
              <li>Entregas vinculadas a evidencia e rastreabilidade</li>
              <li>Painel pronto para uso em desktop e campo</li>
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
              <span>{playing ? 'Reproduzindo agora' : 'Preview de operacao'}</span>
              <span>Corte real do sistema em uso</span>
            </div>
          </div>
        </div>

        <div className="produto-lp__real-gallery">
          <figure className="produto-lp__real-shot produto-lp__card">
            <Image
              src="/branding/screens/operacao-real-poster.jpg"
              alt="Tela real do modulo de estoque do ProntEPI"
              width={1440}
              height={810}
              sizes="(max-width: 900px) 100vw, 48vw"
            />
            <figcaption>Tela real extraida do video operacional</figcaption>
          </figure>
          <figure className="produto-lp__real-shot produto-lp__card">
            <Image
              src="/branding/screens/produto.png"
              alt="Landing comercial do ProntEPI"
              width={720}
              height={1200}
              sizes="(max-width: 900px) 100vw, 48vw"
            />
            <figcaption>Landing comercial com novo posicionamento de venda</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
