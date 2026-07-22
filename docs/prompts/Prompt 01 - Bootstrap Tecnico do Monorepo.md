# Prompt 01 - Bootstrap Tecnico do Monorepo

Use este prompt depois que a documentacao inicial estiver no repositorio local.

```markdown
Leia primeiro:
- README.md
- docs/CURSOR-CONTEXTO.md
- docs/blueprints/Blueprint 00 - Visao Funcional e Arquitetural do Software de Entrega de EPI.md
- docs/blueprints/Blueprint 02 - Roadmap por Epicos e Subetapas.md
- docs/blueprints/Blueprint 05 - Arquitetura Tecnica Inicial e Stack Recomendada.md

Execute apenas a subetapa 01.2 - Bootstrap do projeto.

Objetivo:
Criar a fundacao tecnica do projeto sem implementar regras de negocio. O resultado deve ser um monorepo funcional com web, API, scripts basicos e healthcheck.

Implemente:
- estrutura `apps/web`;
- estrutura `apps/api`;
- estrutura `packages/shared`;
- estrutura `packages/config`;
- TypeScript configurado;
- scripts de build, typecheck e lint, conforme stack escolhida;
- endpoint `GET /health` na API;
- tela inicial simples no web indicando que o projeto subiu;
- README com comandos locais;
- `.env.example` sem segredos reais.

Stack recomendada, salvo motivo claro para ajustar:
- Web: Next.js + React + TypeScript;
- API: NestJS + TypeScript;
- Package manager: pnpm ou npm workspaces;
- Banco ainda nao deve ser configurado nesta subetapa.

Regras:
- Nao implementar autenticacao.
- Nao implementar banco, Prisma ou migrations ainda.
- Nao implementar trabalhadores, EPIs, entrega, estoque, biometria ou relatorios.
- Nao criar app mobile.
- Nao criar offline sync.
- Nao integrar ERP/HCM/eSocial.
- Preservar a documentacao existente.
- Fazer commit e push se o repositorio remoto ja estiver configurado.

Testes obrigatorios:
- executar instalacao das dependencias;
- executar typecheck;
- executar build;
- subir API localmente e validar `GET /health`;
- subir web localmente e validar tela inicial.

Ao final, responda exatamente:
## Resultado
## Arquivos alterados
## Como testar
## Testes executados
## Pendencias
## Commit
```

