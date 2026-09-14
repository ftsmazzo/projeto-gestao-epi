const FAQ = [
  {
    question: 'Funciona para grupos com varios CNPJs?',
    answer:
      'Sim. O portal permite operar varios CNPJs com troca simples de contexto no mesmo login.',
  },
  {
    question: 'Se o trabalhador nao puder assinar na hora, trava a entrega?',
    answer:
      'Nao. Existe assinatura por link no celular e, se necessario, o fluxo presencial continua como contingencia.',
  },
  {
    question: 'Consigo entregar item sem CA quando for necessario?',
    answer:
      'Sim. O sistema aceita entrada manual com nome, descricao e periodo de uso para itens sem CA.',
  },
  {
    question: 'Tem documentos e relatorios prontos para auditoria?',
    answer:
      'Sim. O ProntEPI gera comprovantes, ficha de EPI e relatorios operacionais com rastreabilidade.',
  },
  {
    question: 'O sistema ajuda na implantacao de PGR/PGRO?',
    answer:
      'Sim. O processo de importacao acelera estruturacao de setor, funcao, risco e necessidades de EPI para o cliente operar mais rapido.',
  },
  {
    question: 'Tem validacao de CA pela base oficial do MTE (CAEPI)?',
    answer:
      'Sim. O ProntEPI consulta dados de CAEPI para pesquisa de CA, status e validade, apoiando conformidade na rotina.',
  },
  {
    question: 'Se eu tiver muitos trabalhadores, consigo subir em lote?',
    answer:
      'Sim. E possivel importar base por CSV, revisar e confirmar antes de colocar em producao.',
  },
  {
    question: 'A equipe consegue usar no celular em campo?',
    answer:
      'Sim. A interface foi desenhada para uso em desktop e mobile na operacao diaria.',
  },
  {
    question: 'Existe apoio para implantacao comercial e operacional?',
    answer:
      'Sim. O fluxo comercial pode ser iniciado pelo WhatsApp e seguido por demonstracao guiada para montar plano de implantacao.',
  },
] as const;

export function ProductFaqSection() {
  return (
    <section className="produto-lp__block" aria-labelledby="faq-title" data-reveal>
      <div className="produto-lp__wrap produto-lp__wrap--narrow">
        <p className="produto-lp__kicker">FAQ comercial</p>
        <h2 id="faq-title" className="produto-lp__h2">
          Respostas rapidas para decisoes de compra
        </h2>
        <div className="produto-lp__faq-list">
          {FAQ.map((item) => (
            <details key={item.question} className="produto-lp__faq-item produto-lp__card">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
