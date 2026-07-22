# Deploy no EasyPanel - Gestao de EPI

Guia operacional da subetapa **01.4** para publicar os servicos:

- PostgreSQL (ja criado no EasyPanel);
- `gestao-epi-api`;
- `gestao-epi-web`.

Nao cria Redis, worker nem storage nesta fase.

## 1. Visao geral

| Servico | Tipo | Porta interna | Healthcheck |
| --- | --- | --- | --- |
| PostgreSQL | Database | `5432` | nativo do EasyPanel |
| `gestao-epi-api` | App (Dockerfile) | `3001` | `GET /health` |
| `gestao-epi-web` | App (Dockerfile) | `3000` | HTTP na raiz `/` |

Ordem recomendada:

1. Garantir Postgres saudavel e anotar `DATABASE_URL`.
2. Subir API com as variaveis obrigatorias.
3. Rodar migrations no container da API.
4. Subir Web apontando `NEXT_PUBLIC_API_URL` para a URL publica da API.
5. Ajustar `CORS_ORIGIN` da API para a URL publica do Web.

## 2. Repositorio e build

Contexto de build: **raiz do monorepo**.

Dockerfiles:

- API: `apps/api/Dockerfile`
- Web: `apps/web/Dockerfile`
- Ignore: `.dockerignore` na raiz

Exemplos locais (quando Docker estiver disponivel):

```bash
docker build -f apps/api/Dockerfile -t gestao-epi-api .
docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://SEU-DOMINIO-API -t gestao-epi-web .
```

Os Dockerfiles usam `npm ci --ignore-scripts` e so buildam `@gestao-epi/shared` (e a API/Web) **depois** de copiar o source. Isso evita falha do `postinstall` da raiz, que tenta buildar o shared cedo demais.

No EasyPanel, configure o build a partir do GitHub `ftsmazzo/projeto-gestao-epi`, branch `main`, com Dockerfile relativo acima e contexto na raiz.

## 3. Servico PostgreSQL

Use o Postgres ja provisionado no EasyPanel.

Checklist:

- banco criado;
- usuario/senha fortes;
- rede interna acessivel pelos containers da API;
- `DATABASE_URL` no formato:

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public
```

Se a API e o Postgres estiverem no mesmo projeto EasyPanel, use o hostname interno do servico Postgres (nao a URL publica), salvo orientacao contraria do painel.

## 4. Servico `gestao-epi-api`

### Build

- Dockerfile: `apps/api/Dockerfile`
- Context: `/` (raiz)
- Porta: `3001`

### Healthcheck

- Path: `/health`
- Metodo: `GET`
- Esperado: HTTP 200 e JSON com `"status":"ok"`

Exemplo:

```bash
curl https://SEU-DOMINIO-API/health
```

O Dockerfile ja inclui `HEALTHCHECK` em `/health`. No EasyPanel, configure tambem o healthcheck do servico para `/health`.

### Variaveis de ambiente (API)

| Variavel | Obrigatoria | Exemplo / notas |
| --- | --- | --- |
| `DATABASE_URL` | Sim | Connection string do Postgres EasyPanel |
| `JWT_SECRET` | Sim | Segredo longo e aleatorio (nao reutilizar o de desenvolvimento) |
| `JWT_EXPIRES_IN` | Nao | Padrao `7d` |
| `API_PORT` | Nao | Padrao `3001` |
| `API_HOST` | Nao | Padrao `0.0.0.0` |
| `NODE_ENV` | Recomendado | `production` |
| `CORS_ORIGIN` | Sim em producao | URL publica do Web, ex. `https://app.seudominio.com`. Varias origens: separar por virgula. `*` apenas para debug. |

Nunca versionar segredos reais. Use o painel de secrets/env do EasyPanel.

### Comando de start

Padrao do Dockerfile:

```bash
node dist/main.js
```

(workdir efetivo no container: `/app/apps/api`)

### Migrations em producao

Aplique as migrations **depois** do primeiro deploy da API (ou em job/one-off) e **sempre** apos migrations novas no repositorio.

A imagem da API ja inclui o Prisma Client gerado no build. O comando de migrate nao depende do `postinstall` da raiz.

No shell/terminal do container da API, a partir de `/app` (workdir do monorepo no stage runner antes do `WORKDIR apps/api`; se o shell abrir em `/app/apps/api`, suba um nivel ou use o equivalente abaixo):

```bash
# se o shell estiver em /app/apps/api:
cd /app
npm run db:migrate
```

Equivalente direto (com `DATABASE_URL` ja configurada no servico):

```bash
cd /app
npm run prisma:migrate -w @gestao-epi/api
# ou:
cd /app/apps/api && npx prisma migrate deploy
```

Isso executa `prisma migrate deploy` (seguro para producao). Nao use `prisma migrate dev` em producao.

Checklist pos-migration:

1. `GET /health` responde ok.
2. `POST /auth/register` ou login funciona.
3. `GET /auth/me` com Bearer token funciona.

### Rollback operacional (API)

1. Redeploy da imagem/tag anterior no EasyPanel.
2. Se a migration nova for incompativel com o codigo antigo, restaure backup do Postgres antes do rollback de schema (migrations Prisma normalmente sao forward-only).
3. Valide `/health` e login.

## 5. Servico `gestao-epi-web`

### Build

- Dockerfile: `apps/web/Dockerfile`
- Context: `/` (raiz)
- Build arg importante: `NEXT_PUBLIC_API_URL` = URL **publica** da API (ex. `https://api.seudominio.com`)
- Porta: `3000`

`NEXT_PUBLIC_API_URL` e embutida no build do Next.js. Se a URL da API mudar, rebuild da Web e necessario.

### Variaveis de ambiente (Web)

| Variavel | Obrigatoria | Exemplo / notas |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Sim (no build) | URL publica da API |
| `PORT` | Nao | Padrao `3000` |
| `NODE_ENV` | Recomendado | `production` |
| `HOSTNAME` | Nao | Dockerfile usa `0.0.0.0` |

### Comando de start

```bash
node apps/web/server.js
```

### Validacao

1. Abrir a URL publica do Web.
2. Registrar organizacao em `/register`.
3. Entrar em `/login`.
4. Confirmar dashboard autenticado.

Se o browser bloquear chamadas a API, revise `CORS_ORIGIN` na API e confirme que `NEXT_PUBLIC_API_URL` aponta para o dominio correto (https).

## 6. Encadeamento tipico no EasyPanel

1. Postgres online.
2. Criar app `gestao-epi-api` com Dockerfile da API + envs.
3. Deploy da API.
4. Rodar `npm run db:migrate` no container da API.
5. Testar `https://API/health`.
6. Criar app `gestao-epi-web` com build-arg/env `NEXT_PUBLIC_API_URL`.
7. Deploy da Web.
8. Ajustar `CORS_ORIGIN` da API para a URL da Web e redeployar a API se necessario.
9. Testar registro/login/dashboard de ponta a ponta.

## 7. O que esta fora desta preparacao

- Clientes atendidos e cotas por cliente
- Trabalhadores, EPIs, estoque, entrega, biometria
- Redis, workers, storage S3
- CI automatico de migrate (pode ser adicionado depois)

## 8. Referencias no repositorio

- `.env.example`
- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `.dockerignore`
- `README.md`
