# PRD — Entidade Distribuidora (ProntEPI)

> Product Requirements Document — o quê e por quê, não como.
> Fonte: [x] Entrevista com usuário (conversa de produto + briefings Relata)  [x] Leitura de código existente (fronteira com o ProntEPI atual)

**Data**: 2026-10-02
**Responsável**: a definir (dono do produto ProntEPI)

## 1. Resumo em uma frase

Painel próprio de ERP para uma distribuidora de EPI operar o estoque dela, aberto pelo gestor do SaaS no mesmo lugar em que hoje se abre uma consultoria, integrado ao ProntEPI original só pelo que for explícito (no lançamento, a base de CAEPI).

## 2. Problema e contexto

- Problema real que motiva o projeto: a distribuidora vende muitos SKUs (botina por numeração, luva por tamanho e outras categorias) e o sistema atual (Profit Pay) não cobre o jeito como compram, estocam e, no desenho final, vendem. Sem saldo confiável e sem alerta de cobertura, a compra atrasa e o depósito fura.
- Como é resolvido hoje (concorrência/workaround/nada): operação no Profit Pay, que eles consideram insuficiente. O controle fino de variação, pedido de compra, desconto e fiscal não fecha nesse sistema. Referência de mercado citada por eles: empresas que vendem o EPI e o sistema juntos, e o estoque do fornecedor alimenta a operação do cliente. Isso não entra neste lançamento.
- Por que agora (gatilho): pedido direto dessa distribuidora, com duas gravações no Relata (operação comercial em 2026-10-01 e revisão técnica do Daniel em 2026-10-02). O ProntEPI já tem consultoria, portal do cliente, estoque por empresa e leitura de nota. A distribuidora precisa de telas próprias, sem misturar com a consultoria de SST.

## 3. Público-alvo

- Persona principal: gestor da distribuidora de EPI. Compra, guarda saldo, define cobertura (eles trabalham com 30 a 40 dias) e precisa ver o que está acabando no depósito dele.
- Outros perfis de usuário relevantes:
  - Gestor do SaaS ProntEPI: cria a conta do tipo Distribuidora, no mesmo lugar em que cria a consultoria.
  - Operador de estoque / expedição: dá entrada e baixa no depósito da distribuidora (código de barras no desenho final; no lançamento, entrada confirmada por pessoa).
  - Comprador, financeiro e vendedor: existem no produto final (pedido, orçamento, nota, contas). Ficam fora do lançamento.
  - Consultoria de SST e gestor/operador do portal do cliente: continuam no ProntEPI original. Não usam este painel.

## 4. Objetivos e métricas de sucesso

Metas numéricas não foram definidas. Os objetivos abaixo são do lançamento. As metas marcadas como sugestão não são decisão.

| Objetivo | Métrica | Meta |
|---|---|---|
| A distribuidora opera o depósito dela sem a consultoria de SST | Conta do tipo Distribuidora criada pelo SaaS e uso do painel próprio | 1 distribuidora piloto em operação real |
| Saldo do depósito confiável | Itens com quantidade após entrada confirmada | Sugestão: 100% das entradas do piloto passam por confirmação humana |
| Aviso antes de furar a cobertura | Alertas de estoque baixo disparados quando o saldo atinge o mínimo | Sugestão: mínimo configurável por produto; cobertura-alvo 30 a 40 dias, a calibrar com eles |
| CA ajuda o cadastro, sem virar o catálogo | Consultas à base CAEPI que preenchem descrição a partir do número do CA | Sugestão: o operador ainda confirma o texto antes de gravar |
| Leitura de documento no estilo já usado no ProntEPI | Nota de entrada vira rascunho (fornecedor, itens, quantidade, custo, CA) | Nada entra no saldo sem confirmação |

## 5. Escopo

### Dentro do escopo (lançamento)

- Entidade Distribuidora, quase à parte: o gestor do SaaS abre a conta no mesmo lugar das consultorias, e o usuário entra num painel com telas de ERP, não no painel da consultoria nem no portal do cliente.
- Estoque próprio da distribuidora: produto, variação (numeração, P/M/G e equivalentes), saldo, entrada e saída.
- Estoque mínimo por produto e alerta de estoque baixo.
- Ajuda da base CAEPI já existente: informar o CA preenche dados do certificado para o operador revisar.
- Leitura de documento de entrada (PDF ou imagem de nota de compra) que extrai um rascunho. A gravação no estoque só ocorre depois que uma pessoa confirma. Mesmo princípio da extração de nota que o portal do cliente já usa: a máquina propõe, a pessoa decide.
- Dois identificadores de produto previstos no cadastro, porque a operação deles separa o código do fornecedor (entrada, ligado a NCM) do SKU interno (saída). No lançamento os dois campos existem; a nota fiscal de saída não é emitida ainda.

### Fora do escopo (por enquanto)

- Ligar a distribuidora como almoxarifado de uma empresa já atendida pelo ProntEPI (o Plus: expedição deles vira entrada no estoque do cliente e segue para a ficha). Fica para depois de o estoque próprio estar validado.
- Orçamento, autonomia de desconto, aprovação comercial e relatório de desconto.
- Pedido de compra com duas liberações do financeiro.
- Emissão de NF-e, SEFAZ, certificado A1, CFOP, regimes tributários e reforma tributária.
- Contas a pagar, contas a receber, plano de contas, DRE, fluxo de caixa, contas bancárias e conciliação.
- Agenda/CRM do vendedor e aplicativo ou tablet do representante.
- Vidas, PGR, documentos SST, obras e portal do trabalhador. Isso permanece no ProntEPI da consultoria.
- Gravar estoque automaticamente a partir da leitura do documento, sem confirmação.

### Produto final desta entidade (depois do lançamento, ainda sem o Plus)

O Daniel, em 2026-10-02, validou o desenho comercial já falado e acrescentou o fiscal e o financeiro. Isso define o produto final da Distribuidora, não o lançamento:

- Desconto máximo por vendedor configurável pela empresa (não fixar 3%). Acima do teto, aprovação de um superior.
- Relatórios de desconto (quanto se deixou de ganhar).
- NF-e com integração direta à SEFAZ via certificado A1.
- Configuração tributária no cadastro: NCM e CFOP. Emissor preparado para a reforma tributária. Regimes no mínimo Simples, Lucro Real e Lucro Presumido, com espaço para outros.
- Ordem dos dados: nota de compra entra, alimenta o estoque e gera o contas a pagar. O financeiro também lança contas a pagar que não vêm de nota.
- Plano de contas para DRE e fluxo de caixa.
- Contas bancárias e caixas, saldo inicial e conciliação bancária.
- Agenda do vendedor (histórico de conversa com o cliente). Tablet do representante fica mais à frente ainda.

## 6. Funcionalidades principais

| Funcionalidade | Prioridade (lançamento/depois) | Descrição curta |
|---|---|---|
| Abrir conta Distribuidora no SaaS | Lançamento | Mesmo lugar da consultoria; tipo diferente; painel próprio |
| Cadastro de produto e variação | Lançamento | SKU do fornecedor, SKU interno, NCM, tamanho/numeração |
| Consulta CAEPI | Lançamento | CA informado preenche sugestão; pessoa confirma |
| Entrada de mercadoria | Lançamento | Sobe saldo do depósito da distribuidora |
| Saída interna de mercadoria | Lançamento | Baixa o saldo do depósito dela, sem nota fiscal |
| Estoque mínimo e alerta | Lançamento | Aviso quando o saldo atinge o mínimo configurado |
| Leitura de nota de entrada | Lançamento | PDF/imagem vira rascunho; confirmação humana gera a entrada |
| Pedido de compra com duas aprovações | Depois | Comprador gera, financeiro libera em duas etapas, aí a compra segue |
| Orçamento e desconto | Depois | Tabela da empresa, teto por vendedor, aprovação acima do teto, relatório do que foi concedido |
| NF-e / SEFAZ / A1 | Depois | Emissão com NCM, CFOP, regime tributário e preparação para a reforma |
| Financeiro | Depois | Contas a pagar (automático na nota de compra e lançamento manual), plano de contas, DRE, fluxo de caixa, bancos, saldo inicial, conciliação |
| Agenda do vendedor | Depois | Histórico do que foi falado com cada cliente |
| Plus almoxarifado | Depois, e só com integração explícita | Expedição da distribuidora abastece o estoque de um cliente que já está no ProntEPI |
| Tablet do representante | Depois do comercial | Orçamento em visita, fora da base |

## 7. Restrições de negócio

- Prazo: não há data fechada. Na gravação de 2026-10-01 houve fala de começar a executar em uma semana e meia a duas depois do desenho e da validação do Daniel. Isso não é compromisso deste PRD.
- Orçamento: a definir.
- Legais/regulatórias: no lançamento, LGPD no cadastro de usuários e nos documentos de fornecedor que forem armazenados. NF-e, certificado digital e obrigação fiscal ficam para a fase fiscal. CAEPI é base de consulta de certificado, não substitui responsabilidade do emissor da nota.

## 8. Riscos e premissas

- Premissa: o lançamento gera valor só com estoque próprio, alerta e leitura de nota. Se a distribuidora não operar o piloto sem orçamento e sem nota de saída, o recorte do lançamento está errado e o comercial sobe de prioridade.
- Premissa: a base CAEPI ajuda a preencher descrição, mas o cadastro operacional é o da distribuidora. Se eles precisarem que o CAEPI seja o único cadastro de produto, o lançamento muda.
- Premissa: documento de entrada tem texto ou imagem legível o bastante para um rascunho. PDF só de imagem ruim cai para digitação, como já acontece em extrações fracas no ProntEPI.
- Risco: construir o ERP fiscal e financeiro dentro das telas da consultoria. Impacto alto. A entidade fica com painel próprio para isso não acontecer.
- Risco: tratar o Plus (amarrar a recompra pela ficha do trabalhador) como parte do lançamento. Impacto alto no prazo e mistura dois produtos. Fica explícito como fase posterior.
- Risco: regras tributárias (reforma, regimes, conciliação bancária manual ou automática) ainda sem detalhe do Daniel. Probabilidade alta de retrabalho se a fase fiscal começar antes dessa conversa. Não bloqueia o estoque.
- Em aberto com o Daniel, sem decisão: o que exatamente “preparado para a reforma tributária” exige; regimes além de Simples, Real e Presumido; formato do relatório de desconto; trilha de auditoria da aprovação de desconto; conciliação bancária manual, automática ou mista.

---

## Gaps & Recomendações (preencher só no Modo B — análise de repo existente)

Não se aplica. Este documento é Modo A (produto novo), com a fronteira do ProntEPI atual usada só para não redesenhar a consultoria.
