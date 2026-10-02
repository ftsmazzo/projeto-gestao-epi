# UI/UX Design — Entidade Distribuidora (ProntEPI)

> Direção visual e de experiência.
> Fonte: [x] Entrevista com usuário  [x] Leitura de código existente (shell e tokens do web atual)
> Depende de: [Fluxo do App](FLUXO-APP.md)

**Data**: 2026-10-02

Direção de produto, não layout fechado em pixel. Nenhuma tela abaixo foi aprovada como mockup.

## 1. Referências e tom

- Referências visuais: o próprio ProntEPI. Tokens já usados no web (`--color-ink`, `--color-bg`, `--color-surface-muted`, `--color-sidebar`, `--color-border`) e blocos operacionais já conhecidos (cabeçalho de página, cartão, formulário, aviso). Não se cria paleta nova.
- O que não serve de casca: o menu da consultoria (clientes, PGR, vidas) e o menu do portal do cliente (entregas, ficha, documentos SST). A Distribuidora tem shell próprio.
- Tom: operacional e denso, de depósito. Pouca frase de marketing. Quantidade, variação e saldo aparecem antes de texto explicativo. A leitura de nota é uma revisão, não um chat.

## 2. Plataformas-alvo

- [x] Web responsivo
- [ ] PWA
- [ ] Mobile nativo (iOS/Android)
- [x] Desktop

Desktop é o uso principal (tabela de saldo, entrada e revisão de nota). O web precisa continuar utilizável em tela menor, sem aplicativo. Tablet do vendedor está fora do lançamento.

## 3. Sistema visual

- Paleta de cores: a do ProntEPI atual. Sem cor nova de marca. Alerta de estoque baixo usa o aviso de atenção que o produto já tem. Saldo que não pode sair (quantidade maior que o disponível) usa o aviso de erro já existente.
- Tipografia: a do web atual.
- Componentes centrais:
  - Menu lateral curto, só do depósito: Início, Produtos, Saldo, Entrada, Saída.
  - Tabela de saldo com produto, variação, SKU interno, quantidade e situação (ok ou no mínimo).
  - Formulário curto de produto, com bloco opcional “consultar CA” que mostra a sugestão antes de gravar.
  - Upload de nota e tabela de rascunho editável (descrição lida, quantidade, custo, CA, produto associado).
  - Confirmação explícita no fim do rascunho. Sem botão único que grave saldo ao enviar o arquivo.
  - Lista de estoque baixo no início, com atalho para a entrada daquele item.

## 4. Acessibilidade

Não houve requisito legal nem público específico além do operador de depósito. Sugestão, não meta fechada: rótulo em todo campo, foco visível, contraste do tema atual e mensagem de erro no próprio campo (quantidade inválida, saldo insuficiente, arquivo ilegível). Nível WCAG a definir.

## 5. Telas principais

| Tela | Jornada relacionada | Estado |
|---|---|---|
| Nova conta no SaaS, com tipo Distribuidora | Abrir a conta | Direção fechada na conversa. O formulário atual de consultoria ganha o tipo. O restante do SaaS não muda. |
| Início do depósito | Ver o que está acabando | Direção fechada. Lista de itens no mínimo ou abaixo, e atalhos para entrada e produtos. Sem gráfico de vendas. |
| Produtos | Cadastrar produto | Direção fechada. Lista e formulário com SKU do fornecedor, SKU interno, NCM, variação, mínimo e consulta de CA. |
| Sugestão do CA | Cadastrar produto | Direção fechada. Texto sugerido editável. Salvar não depende da consulta ter dado certo. |
| Saldo | Entrada, saída e alerta | Direção fechada. Tabela do depósito. |
| Entrada manual | Dar entrada manual | Direção fechada. Produto, variação, quantidade, confirmar. |
| Enviar nota | Ler nota de compra | Direção fechada. Arquivo PDF ou imagem. Enviar não altera saldo. |
| Revisar rascunho | Ler nota de compra | Direção fechada. Linhas editáveis, vínculo com produto, confirmar ou descartar. |
| Saída | Dar saída do depósito | Direção fechada. Bloqueio visível se a quantidade passar do saldo. Sem campo de nota fiscal. |
| Acesso negado | Qualquer jornada de quem não é desta conta | Direção fechada. Usuário de consultoria ou do portal do cliente não vê este menu. |

Telas que não entram no lançamento, para não aparecerem vazias no menu: pedido de compra, orçamento, desconto, NF-e, contas, DRE, conciliação, agenda do vendedor, vínculo com empresa do ProntEPI.

---

## Gaps & Recomendações (preencher só no Modo B — análise de repo existente)

Não se aplica. Modo A.
