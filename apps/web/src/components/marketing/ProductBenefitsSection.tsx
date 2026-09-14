const BENEFITS = [
  {
    title: 'Entrega com evidencia forte',
    text: 'Trabalhador, item e validacao facial no mesmo fluxo, com comprovante pronto na hora.',
  },
  {
    title: 'Controle de CA sem surpresa',
    text: 'Pesquisa de CA, validacao instantanea e alerta preventivo para reduzir risco de nao conformidade.',
  },
  {
    title: 'Estoque com rastreabilidade',
    text: 'Entradas, saidas, saldo por local e apoio por nota fiscal para decidir com mais seguranca.',
  },
  {
    title: 'Operacao guiada por prioridade',
    text: 'Painel mostra vencimentos, trocas e pendencias para o time agir no que e critico.',
  },
  {
    title: 'Suporte a EPI sem CA',
    text: 'Permite entrada manual com nome, descricao e periodo de uso para itens especiais.',
  },
  {
    title: 'Assinatura remota sem travar entrega',
    text: 'Trabalhador pode assinar por link no celular e manter fallback presencial quando preciso.',
  },
] as const;

export function ProductBenefitsSection() {
  return (
    <section
      id="beneficios"
      className="produto-lp__block produto-lp__block--tint"
      aria-labelledby="beneficios-title"
      data-reveal
    >
      <div className="produto-lp__wrap">
        <p className="produto-lp__kicker">Beneficios principais</p>
        <h2 id="beneficios-title" className="produto-lp__h2">
          Seis ganhos imediatos para quem opera EPI todo dia
        </h2>
        <ul className="produto-lp__benefits">
          {BENEFITS.map((item) => (
            <li key={item.title} className="produto-lp__card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
