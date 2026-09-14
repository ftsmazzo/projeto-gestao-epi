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
