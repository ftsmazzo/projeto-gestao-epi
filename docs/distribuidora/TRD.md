# TRD — Entidade Distribuidora (ProntEPI)

> Technical Requirements Document — traduz o PRD em decisões técnicas.
> Fonte: [x] Entrevista com usuário  [x] Leitura de código existente
> Depende de: [PRD](PRD.md)

**Data**: 2026-10-02
**Responsável**: a definir (dono do produto ProntEPI)

## 1. Stack tecnológica

A Distribuidora não abre repositório, banco nem deploy novos. Entra no monorepo do ProntEPI, com módulo e rotas próprios. Isso vem da decisão de produto (“mesmo lugar”, “telas próprias”, “quase à parte”), não de uma escolha livre de stack.

| Camada | Tecnologia | Motivo/restrição |
|---|---|---|
| Frontend | Next.js + React + TypeScript, em `apps/web` | Painel já existente. Telas da Distribuidora ficam num grupo de rotas próprio, sem reutilizar o shell da consultoria nem o do portal do cliente. |
| Backend | NestJS + TypeScript, em `apps/api` | Módulo novo. Não estende o serviço de estoque do portal do cliente. |
| Contratos | `packages/shared` | Tipos do painel da Distribuidora ao lado dos tipos atuais, sem misturar com `ServedClient`. |
| Banco de dados | PostgreSQL + Prisma, o mesmo banco do ProntEPI | Isolamento por organização. Banco físico separado fica fora do lançamento. |
| Infra/Deploy | Docker no EasyPanel, os serviços de API e web que já sobem | Migration nova entra no `prisma migrate deploy` que já roda na subida. |

## 2. Integrações externas

| Integração | Finalidade | Observações |
|---|---|---|
| Base CAEPI já importada no ProntEPI | Sugerir descrição e dados do certificado a partir do número do CA | Somente leitura. Não grava o certificado como saldo. O operador confirma antes de salvar o produto. É a única integração com o ProntEPI original no lançamento. |
| Leitura de nota de entrada | PDF com texto ou imagem (JPG/PNG) vira rascunho de entrada | Reaproveita o padrão de `apps/api/src/portal/invoice-extract.ts`: texto do PDF primeiro; visão (OpenAI) quando houver `OPENAI_API_KEY`, hoje só para imagem. PDF sem texto não vira estoque sozinho. Modelo padrão atual da visão: `gpt-4o-mini`, configurável por `OPENAI_VISION_MODEL`. |
| SEFAZ / certificado A1 | Emissão de NF-e | Fora do lançamento. Entra na fase fiscal do PRD. |
| Plus com empresa já cliente do ProntEPI | Expedição da distribuidora vira entrada no estoque daquele cliente | Fora do lançamento. Quando existir, é um contrato explícito entre as duas organizações, não um acesso cruzado ao banco da consultoria. |

Não há ERP externo, gateway de pagamento nem login social neste lançamento.

## 3. Requisitos não-funcionais

- Performance: a definir em número. Sugestão, não decisão: listagem de saldo e alerta de mínimo respondem em tempo de tela operacional (poucos segundos), e a leitura de nota pode ser mais lenta porque depende de extração.
- Escalabilidade: piloto de uma distribuidora, com muitos SKUs e variações (numeração, P/M/G). Volume exato a definir. O desenho não assume várias redes de lojas.
- Segurança: login do mesmo mecanismo de sessão da consultoria (usuário da organização, papel de membro). Usuário da Distribuidora não autentica como gestor do portal do cliente e não lista `ServedClient` de outra organização. Documento de nota fica armazenado no mesmo estilo dos documentos de nota do portal (arquivo fora do banco, referência no registro). Segredo de API de visão permanece em variável de ambiente, nunca no repositório.
- Compliance: LGPD sobre usuários e arquivos de fornecedor guardados. Certificado digital A1 e obrigação fiscal não se aplicam ao lançamento.
- Disponibilidade: a mesma da API e do web atuais. SLA próprio a definir.
- Internacionalização/idiomas: português apenas.

## 4. Ambiente e deploy

- Onde roda: os containers atuais da API e do web no EasyPanel. Sem serviço novo no lançamento.
- Provedor: EasyPanel, já usado pelo ProntEPI.
- CI/CD: o fluxo já usado no repositório (push na branch que o EasyPanel acompanha e migrate na subida da API). Não se cria pipeline só para a Distribuidora.

## 5. Restrições herdadas

- Sistemas legados a integrar: nenhum sistema da distribuidora (Profit Pay) será integrado. A carga inicial de produtos, se houver, é a definir (cadastro manual ou planilha). Não é premissa do lançamento.
- Decisões técnicas já tomadas e não-negociáveis:
  - Mesmo monorepo, mesma API, mesmo web, mesmo PostgreSQL.
  - Tipo de organização distinto de consultoria, para o gestor do SaaS criar a conta no fluxo que já existe e o aplicativo abrir outro painel.
  - Estoque, produto e movimentação da Distribuidora não reutilizam `EpiStockBalance` / entrega / ficha do cliente. Esses modelos estão amarrados a `ServedClient` e a vidas.
  - Confirmação humana antes de qualquer entrada sugerida por leitura de documento.
  - CAEPI é consulta, não catálogo mestre da distribuidora.

Sugestão de modelo, não decisão fechada de colunas (isso fica no esquema de backend): um discriminador na `Organization` (consultoria ou distribuidora) e tabelas novas de depósito, produto, variação, saldo e movimento, todas com `organizationId`. Consultoria continua com franquia de vidas. Distribuidora não consome essa franquia no lançamento.

## 6. Manutenção

- Quem mantém o código após o lançamento: o mesmo time que mantém o ProntEPI. Nome do responsável a definir.
- Nível de complexidade aceitável: um módulo Nest e um grupo de páginas. Sem segundo aplicativo, sem segundo banco e sem copiar o wizard de PGR. A leitura de nota copia o comportamento (rascunho + confirmação), não precisa duplicar o arquivo inteiro se der para extrair um núcleo comum. Se a extração comum atrasar o piloto, um adaptador específico da nota de compra da distribuidora é aceitável, desde que o saldo só mude na confirmação.

---

## Gaps & Recomendações (preencher só no Modo B — análise de repo existente)

Não se aplica. Modo A.
