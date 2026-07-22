# Prompt 02 - Auth e Tenancy Inicial

Use este prompt somente depois do bootstrap tecnico estar aprovado.

```markdown
Leia primeiro:
- README.md
- docs/CURSOR-CONTEXTO.md
- docs/blueprints/Blueprint 04 - Modelo de Dados e Fronteiras de Dominio.md
- docs/blueprints/Blueprint 05 - Arquitetura Tecnica Inicial e Stack Recomendada.md
- docs/blueprints/Blueprint 03 - Criterios de Aceite e Revisao por Entrega.md

Execute apenas a subetapa 01.3 - Autenticacao e tenancy inicial.

Objetivo:
Criar a primeira base de autenticacao, organizacao e isolamento multiempresa, sem implementar ainda cadastros de EPI ou entrega.

Implemente:
- banco PostgreSQL e ORM/migrations conforme stack do projeto;
- modelo inicial de `User`;
- modelo inicial de `Organization`;
- modelo inicial de `Membership`;
- registro de usuario dono de organizacao;
- login;
- endpoint de usuario autenticado;
- guard/middleware de autenticacao;
- estrutura inicial de auditoria para eventos criticos;
- telas basicas de login, registro e dashboard autenticado.

Regras:
- Nao implementar trabalhadores.
- Nao implementar EPIs.
- Nao implementar estoque.
- Nao implementar entrega.
- Nao implementar biometria.
- Nao implementar relatorios.
- Garantir que organizacao seja a fronteira principal de dados.
- Criar migration apenas para os modelos desta subetapa.
- Nao commitar segredos.
- Atualizar `.env.example`.
- Fazer commit e push.

Testes obrigatorios:
- typecheck;
- build;
- migration local;
- teste de registro;
- teste de login;
- teste de acesso autenticado;
- teste de acesso sem token retornando erro adequado.

Ao final, responda exatamente:
## Resultado
## Arquivos alterados
## Como testar
## Testes executados
## Pendencias
## Commit
```

