const STEPS = [
  {
    n: '01',
    title: 'Implante por cliente',
    text: 'A consultoria organiza estrutura, riscos e requisitos de EPI por CNPJ.',
  },
  {
    n: '02',
    title: 'Opere no portal da empresa',
    text: 'Equipe executa entregas, estoque e validade em um fluxo simples e rapido.',
  },
  {
    n: '03',
    title: 'Comprove quando precisar',
    text: 'Comprovantes, fichas e relatorios ficam prontos para auditoria e gestao.',
  },
] as const;

export function ProductStepsSection() {
  return (
    <section id="como" className="produto-lp__block" aria-labelledby="como-title" data-reveal>
      <div className="produto-lp__wrap">
        <p className="produto-lp__kicker">Como funciona</p>
        <h2 id="como-title" className="produto-lp__h2">
          Da implantacao a comprovacao em tres etapas
        </h2>
        <ol className="produto-lp__steps">
          {STEPS.map((step) => (
            <li key={step.n} className="produto-lp__card">
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
  );
}
