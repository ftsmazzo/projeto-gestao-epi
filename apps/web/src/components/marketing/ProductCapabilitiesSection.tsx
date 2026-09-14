const CAPABILITIES = [
  {
    title: 'Entrega com prova facial',
    text: 'Entrega presencial com validacao facial e comprovante pronto no mesmo fluxo.',
  },
  {
    title: 'Assinatura por link no celular',
    text: 'Quando precisa, envia link para o trabalhador assinar remotamente sem travar a operacao.',
  },
  {
    title: 'Estoque por local e rastreio',
    text: 'Entradas, saidas, saldo por local e apoio de nota fiscal para auditoria.',
  },
  {
    title: 'CA validado na operacao',
    text: 'Pesquisa de CA e checagem de validade para reduzir risco de uso indevido.',
  },
  {
    title: 'EPI sem CA tambem controlado',
    text: 'Entrada manual com nome, descricao e periodo de uso para itens sem CA.',
  },
  {
    title: 'Cobertura por setor e funcao',
    text: 'Estrutura SST conectada ao dia a dia: setor, funcao, risco e requisito de EPI.',
  },
  {
    title: 'Importacao de PGR/PGRO',
    text: 'Leitura de documentos Word/PDF com reforco por IA para acelerar implantacao.',
  },
  {
    title: 'Relatorios e fichas prontas',
    text: 'Ficha de EPI, comprovantes e relatorios de validade, cobertura e substituicao.',
  },
] as const;

export function ProductCapabilitiesSection() {
  return (
    <section className="produto-lp__block produto-lp__block--tint" aria-labelledby="cap-title" data-reveal>
      <div className="produto-lp__wrap">
        <p className="produto-lp__kicker">Tudo que voce viu nos documentos</p>
        <h2 id="cap-title" className="produto-lp__h2">
          O ProntEPI cobre ponta a ponta da gestao de EPI
        </h2>
        <p className="produto-lp__text">
          Este bloco resume os recursos que normalmente ficam espalhados em varios sistemas, planilhas
          e controles paralelos.
        </p>
        <ul className="produto-lp__cap-grid">
          {CAPABILITIES.map((item) => (
            <li key={item.title} className="produto-lp__cap-item produto-lp__card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
