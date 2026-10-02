# Esquema Backend — Entidade Distribuidora (ProntEPI)

> Modelagem de dados e API.
> Fonte: [x] Entrevista com usuário  [x] Leitura de código existente (`Organization`, `Membership`, `CaCertificate`, extração de nota do portal)
> Depende de: [TRD](TRD.md)

**Data**: 2026-10-02

Isto é o modelo do lançamento. Pedido de compra, orçamento, NF-e, financeiro e o Plus não têm tabela aqui.

## 1. Entidades principais

A conta continua sendo `Organization`. Ganha um tipo. Consultoria permanece o padrão de hoje. Distribuidora não usa franquia de vidas, `ServedClient` nem `EpiStockBalance`.

| Entidade | Campos-chave | Relacionamentos |
|---|---|---|
| `Organization` (já existe) | `kind`: `CONSULTORIA` ou `DISTRIBUIDORA`. Consultoria existente migra como `CONSULTORIA`. | Uma distribuidora tem produtos, documentos de entrada e membros. Não tem clientes atendidos neste lançamento. |
| `DistributorProduct` | `organizationId`, nome, `supplierSku`, `internalSku`, `ncm` opcional, `minQuantity` opcional, `caNumber` opcional (texto, não chave obrigatória) | Pertence a uma organização. Tem variações. `internalSku` único dentro da organização. |
| `DistributorVariant` | `productId`, rótulo da variação (numeração ou P/M/G) | Única por produto. Tem um saldo. |
| `DistributorBalance` | `variantId`, `quantity` (inteiro, nunca negativo) | Um saldo por variação. Só muda por movimento confirmado. |
| `DistributorMovement` | `variantId`, tipo `IN` ou `OUT`, quantidade, origem `MANUAL` ou `INVOICE`, `createdByUserId` | Entrada soma, saída subtrai. Saída recusada se passar do saldo. |
| `DistributorInboundDocument` | `organizationId`, arquivo, status `DRAFT`, `CONFIRMED` ou `DISCARDED`, fornecedor e número da nota se a leitura achar, JSON do rascunho | Linhas do rascunho. Confirmar gera movimentos `IN`. Descartar não gera movimento. |
| `DistributorInboundLine` | descrição lida, quantidade, custo em centavos opcional, `caNumber` opcional, `variantId` opcional | Sem `variantId`, a linha não entra na confirmação. |
| `CaCertificate` (já existe) | `caNumber` único | Só leitura. A consulta copia `equipmentName` e a descrição para a sugestão na tela. Não cria saldo. |
| `User` e `Membership` (já existem) | e-mail, senha, papel na organização | O gestor e o operador da distribuidora são membros dessa `Organization`, não usuários de portal de cliente. |

Custo da linha fica guardado no rascunho para a fase financeira usar depois. No lançamento ele não calcula preço de venda nem contas a pagar.

## 2. Autenticação e autorização

- Método: o login que a consultoria já usa (`User` + senha + sessão). Sem SSO e sem login do portal do cliente.
- Quem cria a organização: `User` com `isPlatformAdmin`. O tipo escolhido é `DISTRIBUIDORA`.
- Papéis neste lançamento, reusando `MembershipRole`:
  - `OWNER` e `ADMIN`: gestor da distribuidora. Cadastro de produto, mínimo, entrada, saída, confirmar ou descartar rascunho.
  - `MEMBER`: operador de estoque. Entrada, saída, envio de nota e confirmação de rascunho. Não cria outra organização.
- Toda query filtra `organizationId` do membro e exige `kind = DISTRIBUIDORA`. Membro de consultoria recebe recusa neste módulo. Usuário de `ClientUserMembership` não chama estes endpoints.

## 3. Endpoints/ações principais

Prefixo sugerido: `/distributor`. Nomes finais podem ajustar na implementação, as regras não.

| Endpoint/Ação | Método | Autenticado? | Regra de negócio relevante |
|---|---|---|---|
| Criar organização Distribuidora | POST no fluxo atual de tenant do SaaS, com `kind` | Platform admin | Não abre cota de vidas nem cliente. |
| Listar produtos e variações | GET | Membro da distribuidora | Só a organização da sessão. |
| Criar ou editar produto e variação | POST/PATCH | OWNER ou ADMIN | `internalSku` único na organização. `minQuantity` vazio significa sem alerta. |
| Consultar CA | GET | Membro | Busca `CaCertificate` pelo número. Não grava. CA ausente devolve vazio, não erro que impeça o cadastro. |
| Ver saldo | GET | Membro | Quantidade por variação e marca de “no mínimo” quando `minQuantity` existe e o saldo está menor ou igual. |
| Entrada manual | POST | Membro | Cria movimento `IN` e soma o saldo. Quantidade menor que 1 recusa. |
| Saída | POST | Membro | Cria movimento `OUT` só se o saldo alcançar. Não emite nota. |
| Enviar nota de compra | POST arquivo | Membro | Grava arquivo e documento em `DRAFT`. Extrai rascunho. Não mexe no saldo. |
| Confirmar rascunho | POST | Membro | Só linhas com variação. Gera um `IN` por linha e muda o documento para `CONFIRMED`. Segunda confirmação não soma de novo. |
| Descartar rascunho | POST | Membro | Status `DISCARDED`. Saldo intacto. |
| Alertas | GET | Membro | Variações com mínimo definido e saldo no limite ou abaixo. Sem job. |

## 4. Processamento assíncrono

Nenhum no lançamento. A leitura da nota roda no pedido de upload, no mesmo estilo da extração de nota do portal: texto do PDF primeiro, visão só para imagem quando `OPENAI_API_KEY` existir. Se a leitura falhar, o documento continua em rascunho vazio e a pessoa usa a entrada manual.

Alerta de estoque baixo é uma consulta, não uma fila. E-mail ou WhatsApp desse alerta fica a definir e fora do lançamento.

SEFAZ, certificado A1 e o Plus (movimento que também entra no estoque de um `ServedClient`) não têm job aqui.

## 5. Armazenamento

- Estruturado: as tabelas acima, no PostgreSQL atual.
- Arquivo: PDF ou imagem da nota de compra, no mesmo padrão de diretório dos documentos de nota do portal, com o caminho relativo no `DistributorInboundDocument`.
- Dado sensível: senha já hasheada em `User`. A nota pode ter CNPJ e valor de fornecedor. Fica restrita à organização. Não entra em log de texto aberto.
- Volume esperado: uma distribuidora piloto e muitos SKUs com variação. Número a definir. Índice em `organizationId`, em `internalSku` por organização e em `caNumber` na consulta ao certificado (o índice único de `CaCertificate.caNumber` já existe).

---

## Gaps & Recomendações (preencher só no Modo B — análise de repo existente)

Não se aplica. Modo A.
