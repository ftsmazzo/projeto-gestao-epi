# Projeto - Gestao Digital de Entrega de EPI

## Objetivo

Construir uma aplicacao completa para gestao digital de entrega de Equipamentos de Protecao Individual, combinando os melhores pontos observados nas solucoes de referencia:

- entrega por biometria facial;
- ficha eletronica aderente a NR-06;
- controle de estoque, lote, CA e validade;
- entrega por perfil, cargo, area ou GHE;
- solicitacao, aprovacao, retirada e devolucao;
- relatorios e trilha de auditoria;
- base preparada para integracoes com ERP/HCM/eSocial;
- evolucao futura para app mobile, offline e totens.

## Estado atual

Fase: **Epico 01 / Subetapa 01.2** — bootstrap tecnico do monorepo.

Ja existe fundacao de codigo com:

- monorepo npm workspaces;
- `apps/web` (Next.js + React + TypeScript);
- `apps/api` (NestJS + TypeScript);
- `packages/shared` e `packages/config`;
- endpoint `GET /health`;
- tela inicial do web admin.

Ainda **nao** ha autenticacao, banco, Prisma, regras de negocio, biometria ou integracoes.

## Documentos principais

- `docs/CURSOR-CONTEXTO.md`: contexto que o Cursor deve ler antes de qualquer implementacao.
- `docs/blueprints/`: Blueprints funcionais, tecnicos e operacionais.
- `docs/prompts/`: prompts prontos para iniciar a execucao em subetapas.
- `docs/referencias/`: documento colado/analisado pelo Cursor a partir dos links de benchmark.

## Estrutura do monorepo

```text
apps/
  api/          # NestJS - API HTTP
  web/          # Next.js - Web admin
packages/
  shared/       # Tipos e constantes compartilhados
  config/       # tsconfig / eslint base
docs/           # Documentacao do produto
```

## Pre-requisitos

- Node.js 20+
- npm 10+ (workspaces)

## Comandos locais

Instalar dependencias (na raiz):

```bash
npm install
```

Typecheck:

```bash
npm run typecheck
```

Lint:

```bash
npm run lint
```

Build de todos os workspaces:

```bash
npm run build
```

Subir API (porta `3001` por padrao):

```bash
npm run dev:api
```

Subir Web (porta `3000` por padrao):

```bash
npm run dev:web
```

Validar healthcheck:

```bash
curl http://localhost:3001/health
```

## Variaveis de ambiente

Copie `.env.example` para `.env` e ajuste se necessario. Nao coloque segredos reais no repositorio.

| Variavel | Padrao | Uso |
| --- | --- | --- |
| `API_PORT` | `3001` | Porta da API |
| `API_HOST` | `0.0.0.0` | Host da API |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL da API para o web |
| `PORT` | `3000` | Porta do Next.js |

## Decisoes iniciais assumidas

- Produto sera tratado como SaaS multiempresa desde a fundacao.
- MVP sera web admin + API; app mobile/offline vira epico posterior.
- Biometria facial deve ser planejada por adapter/SDK externo, nao por algoritmo proprio no MVP.
- Estoque sera modulo proprio inicialmente, com integracao ERP posterior.
- EasyPanel sera considerado deploy preferencial quando a stack for confirmada.
- Banco/Prisma entram em subetapas posteriores; nao fazem parte deste bootstrap.
- Empresa usuaria (tenant) contrata franquia total de vidas e distribui cotas entre clientes atendidos.
- Tenant, cliente atendido e unidade operacional sao entidades distintas; vida = trabalhador ativo do cliente atendido.
- O sistema deve controlar vidas contratadas, alocadas, usadas e disponiveis. Ver `docs/decisions.md` (D07).

## Regra de execucao

Cada subetapa deve ser pequena, com commit separado, testes proporcionais e resposta final padronizada.

O Cursor deve sempre ler `docs/CURSOR-CONTEXTO.md` e o Blueprint do epico antes de alterar codigo.
