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

Fase: **Epico 01 / Subetapa 01.6** — shell operacional, navegacao e dashboard inicial.

Ja existe:

- monorepo npm workspaces;
- Web Admin com navegacao operacional e paginas placeholder dos modulos;
- dashboard com resumo do tenant, franquia e roteiro;
- login, registro e logout;
- API NestJS com auth JWT, Prisma e healthcheck;
- Dockerfiles e guia EasyPanel.

Ainda **nao** ha clientes atendidos, cotas por cliente, trabalhadores, EPIs, estoque, entrega ou biometria.

## Documentos principais

- `docs/CURSOR-CONTEXTO.md`: contexto que o Cursor deve ler antes de qualquer implementacao.
- `docs/blueprints/`: Blueprints funcionais, tecnicos e operacionais.
- `docs/prompts/`: prompts prontos para iniciar a execucao em subetapas.
- `docs/deploy/EASYPANEL.md`: passo a passo de deploy (Postgres, API, Web).
- `docs/referencias/`: documento colado/analisado pelo Cursor a partir dos links de benchmark.
- `docs/decisions.md`: decisoes estruturais (inclui D07 franquia/cotas).

## Estrutura do monorepo

```text
apps/
  api/          # NestJS - API HTTP + Prisma (+ Dockerfile)
  web/          # Next.js - Web admin (+ Dockerfile)
packages/
  shared/       # Tipos e constantes compartilhados
  config/       # tsconfig / eslint base
docs/
  deploy/       # Guias de deploy (EasyPanel)
```

## Pre-requisitos

- Node.js 20+
- npm 10+ (workspaces)
- PostgreSQL acessivel via `DATABASE_URL` (EasyPanel ou local)
- Docker (opcional, para build local das imagens)

## Comandos locais

Instalar dependencias (na raiz):

```bash
npm install
```

Configurar ambiente:

```bash
cp .env.example .env
# edite DATABASE_URL, JWT_SECRET e CORS_ORIGIN
```

Aplicar migrations:

```bash
npm run db:migrate
```

Typecheck / lint / build:

```bash
npm run typecheck
npm run lint
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

### Build Docker (se Docker estiver disponivel)

```bash
docker build -f apps/api/Dockerfile -t gestao-epi-api .
docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 -t gestao-epi-web .
```

Detalhes de producao: `docs/deploy/EASYPANEL.md`.

## Variaveis de ambiente

Copie `.env.example` para `.env` e ajuste. Nao coloque segredos reais no repositorio.

| Variavel | Padrao | Uso |
| --- | --- | --- |
| `API_PORT` | `3001` | Porta da API |
| `API_HOST` | `0.0.0.0` | Host da API |
| `DATABASE_URL` | — | PostgreSQL (obrigatorio) |
| `JWT_SECRET` | — | Segredo do JWT (obrigatorio) |
| `JWT_EXPIRES_IN` | `7d` | Expiracao do token |
| `CORS_ORIGIN` | `*` / reflect | Origens permitidas do Web (virgula para varias) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL da API para o web |
| `PORT` | `3000` | Porta do Next.js |

## Decisoes iniciais assumidas

- Produto sera tratado como SaaS multiempresa desde a fundacao.
- MVP sera web admin + API; app mobile/offline vira epico posterior.
- Biometria facial deve ser planejada por adapter/SDK externo, nao por algoritmo proprio no MVP.
- Estoque sera modulo proprio inicialmente, com integracao ERP posterior.
- EasyPanel sera considerado deploy preferencial quando a stack for confirmada.
- Empresa usuaria (tenant) contrata franquia total de vidas e distribui cotas entre clientes atendidos.
- Tenant, cliente atendido e unidade operacional sao entidades distintas; vida = trabalhador ativo do cliente atendido.
- O sistema deve controlar vidas contratadas, alocadas, usadas e disponiveis. Ver `docs/decisions.md` (D07).
- Nesta etapa, apenas a franquia total (`contractedLifeQuota`) foi preparada em `Organization`.

## Regra de execucao

Cada subetapa deve ser pequena, com commit separado, testes proporcionais e resposta final padronizada.

O Cursor deve sempre ler `docs/CURSOR-CONTEXTO.md` e o Blueprint do epico antes de alterar codigo.
