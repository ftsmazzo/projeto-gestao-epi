# Plano de Implementação — Entidade Distribuidora (ProntEPI)

> Roteiro de execução. No Modo B, funciona como "Plano de Melhoria".
> Depende de: [PRD](PRD.md), [TRD](TRD.md), [FLUXO-APP](FLUXO-APP.md), [UIUX](UIUX.md), [ESQUEMA-BACKEND](ESQUEMA-BACKEND.md).

**Data**: 2026-10-02

## 1. MVP

O piloto é testável quando uma distribuidora, criada pelo gestor do SaaS, controla o depósito dela sem entrar na consultoria e sem emitir nota fiscal.

Precisa existir:

- Tipo `DISTRIBUIDORA` na organização, sem franquia de vidas.
- Primeiro gestor entra no painel próprio (Início, Produtos, Saldo, Entrada, Saída).
- Produto com variação, SKU do fornecedor, SKU interno, NCM opcional e estoque mínimo opcional.
- Consulta ao `CaCertificate` pelo número do CA, como sugestão. CA ausente não impede o cadastro.
- Entrada manual soma o saldo. Saída só grava se houver quantidade. Não há campo de NF-e.
- Upload de nota de compra gera rascunho. O saldo só muda na confirmação das linhas ligadas a uma variação. Descartar não altera saldo.
- Início lista variações cujo saldo atingiu o mínimo.
- Membro de consultoria e usuário de portal de cliente não chamam este módulo.

## 2. Fases seguintes

| Fase | Escopo | Prioridade | Dependências |
|---|---|---|---|
| 1 (MVP) | Entidade, painel, estoque próprio, CAEPI, leitura de nota com confirmação, alerta de mínimo | Alta | Nenhuma integração nova. Base CAEPI já importada. Chave de visão só se quiserem foto; PDF com texto não depende dela. |
| 2 | Pedido de compra com duas liberações do financeiro e recebimento que vira a entrada já existente | Depois que o piloto usar o saldo de verdade | Fase 1 estável. |
| 3 | Orçamento, teto de desconto configurável por vendedor, aprovação acima do teto, relatório do que foi concedido | Depois da compra | Fase 2. Formato do relatório ainda em aberto com o Daniel. |
| 4 | NF-e na SEFAZ, certificado A1, CFOP, regime tributário, preparação da reforma | Depois do comercial | Detalhe da reforma, regimes além de Simples, Real e Presumido, e trilha da aprovação de desconto. Sem isso a fase não começa. |
| 5 | Contas a pagar geradas pela nota de compra, lançamento manual, plano de contas, DRE, fluxo de caixa, bancos, saldo inicial, conciliação | Junto ou logo após a fase 4 | Definir se a conciliação é manual, automática ou mista. |
| 6 | Agenda do vendedor | Depois do financeiro operacional | Nenhuma ligação com o portal do cliente. |
| 7 | Plus: saída da distribuidora abastece o estoque de uma empresa já cliente do ProntEPI | Só com as duas contas estáveis | Contrato explícito entre organizações. Não reutiliza `EpiStockBalance` por atalho. |
| 8 | Tablet do representante para orçamento em visita | Por último | Fase 3. |

## 3. Marcos externos

- Data de lançamento/demo: a definir. A fala de “uma semana e meia a duas” na gravação de 2026-10-01 não é marco deste plano.
- Outras datas relevantes: nenhuma. A validação com a distribuidora piloto é o marco da fase 1. A conversa que falta com o Daniel é o marco que libera a fase 4.

## 4. Critério de "pronto" por fase

- Fase 1: uma organização de teste do tipo Distribuidora percorre as seis jornadas do fluxo sem gravar saldo na leitura da nota, sem emitir NF-e e sem aparecer no menu da consultoria. Entrada, saída e alerta batem com a quantidade guardada. Consulta de CA existente preenche sugestão. CA inexistente segue cadastro manual.
- Fase 2: pedido só vira entrada depois das duas liberações. Pedido recusado não mexe no saldo.
- Fase 3: desconto dentro do teto configurado segue. Acima do teto fica parado até um superior aprovar. O relatório mostra o concedido no período.
- Fase 4: uma nota de saída de teste é autorizada na SEFAZ no regime configurado da empresa piloto, com NCM e CFOP. Sem certificado A1 válido, a emissão não dispara.
- Fase 5: a nota de compra confirmada gera conta a pagar. DRE e fluxo de caixa saem do plano de contas. Conciliação segue a regra que o Daniel fechar (manual, automática ou mista).
- Fase 6: o gestor lê o histórico que o vendedor registrou naquele cliente.
- Fase 7: uma saída confirmada na distribuidora aumenta o estoque da empresa vinculada no ProntEPI, e a ficha dessa empresa continua sendo a do produto atual.
- Fase 8: o representante monta um orçamento no tablet com as mesmas regras de desconto da fase 3.

---

## Modo B — Plano de Melhoria (usar em vez das seções acima, quando analisando repo existente)

Não se aplica. Modo A.
