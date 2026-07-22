# Blueprint 05 - Arquitetura Tecnica Inicial e Stack Recomendada

## 1. Objetivo

Definir uma arquitetura tecnica inicial para iniciar o projeto de forma simples, escalavel e adequada ao uso futuro no Cursor.

Este documento sugere stack, servicos, limites e ordem tecnica. A stack ainda pode ser ajustada antes do primeiro bootstrap.

## 2. Direcao recomendada

Para este tipo de produto, a recomendacao inicial e:

- monorepo;
- web admin;
- API separada;
- banco PostgreSQL;
- migrations versionadas;
- camada de dominio bem separada;
- adaptadores para biometria, storage e integracoes externas;
- deploy por containers.

## 3. Stack sugerida

### Opcao recomendada

- Monorepo: pnpm workspaces ou npm workspaces.
- Web: Next.js + React + TypeScript.
- API: NestJS + TypeScript.
- Banco: PostgreSQL.
- ORM: Prisma.
- Validacao: Zod ou class-validator, conforme padrao escolhido.
- Testes: Vitest/Jest para unidade; Playwright futuramente para web.
- Filas: Redis/BullMQ em fase posterior.
- Storage: S3-compatible em fase posterior.
- Deploy: Docker + EasyPanel.

### Por que esta opcao

- TypeScript de ponta a ponta reduz atrito entre web e API.
- NestJS organiza modulos, guards, services e controllers de forma clara.
- PostgreSQL atende bem entidades relacionais, auditoria e relatorios.
- Prisma facilita migrations e leitura de schema pelo Cursor.
- EasyPanel combina com operacao simples via containers.

## 4. Estrutura inicial recomendada

```text
apps/
  api/
  web/
packages/
  shared/
  config/
docs/
  blueprints/
  prompts/
  deploy/
  decisions/
```

## 5. Servicos iniciais

### API

Responsabilidades:

- autenticar usuarios;
- aplicar tenancy;
- expor endpoints do dominio;
- validar regras de negocio;
- registrar auditoria;
- executar migrations via pipeline/processo operacional.

Nao deve:

- implementar reconhecimento facial proprio;
- armazenar segredo em codigo;
- depender diretamente de ERP externo no nucleo.

### Web admin

Responsabilidades:

- login;
- dashboard operacional;
- cadastros;
- fluxo de entrega web;
- relatorios;
- administracao de usuarios.

Nao deve:

- conter regra de negocio critica apenas no frontend;
- acessar banco diretamente.

### Worker futuro

Responsabilidades futuras:

- alertas;
- sincronizacoes;
- envio de webhooks;
- importacoes pesadas;
- jobs de vencimento;
- reconciliacao offline.

Nao criar worker no bootstrap se nao houver uso real ainda.

## 6. Modulos tecnicos da API

Ordem sugerida:

1. `health`;
2. `auth`;
3. `organizations`;
4. `users/memberships`;
5. `workers`;
6. `epis`;
7. `stock`;
8. `deliveries`;
9. `evidence`;
10. `reports`;
11. `audit`;
12. `integrations`.

## 7. Estrategia de biometria

Biometria deve ser desenhada como interface/adaptador:

- `BiometricProvider`;
- `enrollFace`;
- `verifyFace`;
- `getEnrollmentStatus`;
- `deleteEnrollment`;

No MVP tecnico, pode existir um provider `mock` para simular fluxo sem capturar dados reais.

Provider real deve ser escolhido depois considerando:

- liveness;
- template seguro;
- LGPD;
- suporte mobile/webcam;
- custo;
- armazenamento;
- evidencias de auditoria;
- SDK para app futuro.

## 8. Estrategia de ficha eletronica

Ficha nao deve ser apenas PDF.

A ficha deve nascer como historico estruturado de eventos:

- entrega;
- devolucao;
- troca;
- cancelamento;
- ajuste;
- assinatura;
- evidencia.

PDF e exportacao sao produtos derivados, nao fonte de verdade.

## 9. Estrategia de offline

Offline nao deve entrar no MVP inicial de codigo.

Quando entrar, deve ter:

- pacote offline versionado;
- fila local;
- identificadores idempotentes;
- reconciliacao de estoque;
- trilha de conflitos;
- criptografia local;
- politica de expiracao do pacote.

## 10. Estrategia de integracoes

ERP/HCM/eSocial devem ser tratados por eventos e adapters.

O nucleo deve registrar a entrega mesmo que a integracao externa falhe. Depois, a integracao processa eventos pendentes.

Regras:

- idempotencia obrigatoria;
- reprocessamento;
- logs sem segredos;
- mapeamento de chaves externas;
- status visivel para administradores.

## 11. Estrategia de deploy

Preferencia inicial:

- Postgres;
- API;
- Web;
- Redis apenas quando houver filas/jobs;
- storage S3-compatible quando houver evidencias/anexos reais.

EasyPanel deve receber:

- Dockerfile por app;
- variaveis de ambiente documentadas;
- healthcheck;
- comando de migration;
- plano de rollback.

## 12. Primeiro incremento tecnico recomendado

O primeiro prompt de codigo deve fazer apenas:

- bootstrap do monorepo;
- apps `api` e `web`;
- TypeScript;
- lint/typecheck/build;
- healthcheck na API;
- tela inicial simples no web;
- Dockerfiles iniciais, se nao aumentar demais o escopo;
- README com comandos.

Nao deve implementar:

- auth;
- banco;
- Prisma;
- entrega;
- estoque;
- biometria;
- relatorios;
- app mobile;
- offline.

