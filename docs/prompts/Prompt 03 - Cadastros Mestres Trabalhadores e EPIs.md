# Prompt 03 - Cadastros Mestres Trabalhadores e EPIs

Use este prompt somente depois de auth e tenancy estarem aprovados.

```markdown
Leia primeiro:
- README.md
- docs/CURSOR-CONTEXTO.md
- docs/blueprints/Blueprint 01 - Catalogo Rico de Funcoes do Software de Entrega de EPI.md
- docs/blueprints/Blueprint 04 - Modelo de Dados e Fronteiras de Dominio.md
- docs/blueprints/Blueprint 06 - UX Operacional e Mapa de Telas.md

Execute apenas o Epico 02 - Cadastros mestres, em recorte inicial.

Objetivo:
Criar os cadastros basicos necessarios para preparar a futura entrega de EPI: unidades/areas, trabalhadores e EPIs.

Implemente:
- CRUD basico de unidades;
- CRUD basico de areas;
- CRUD basico de trabalhadores;
- CRUD basico de EPIs;
- campos essenciais de CA, validade, vida util e status;
- filtros simples por status e unidade;
- telas web correspondentes;
- auditoria basica de criacao/alteracao.

Regras:
- Nao implementar estoque ainda.
- Nao implementar entrega ainda.
- Nao implementar biometria.
- Nao implementar importacao por planilha.
- Nao implementar relatorios avancados.
- Todos os dados devem respeitar organization/tenant.
- Criar migrations necessarias.
- Preservar fluxos de login e dashboard.
- Fazer commit e push.

Testes obrigatorios:
- typecheck;
- build;
- migrations;
- criar/editar/listar unidade;
- criar/editar/listar trabalhador;
- criar/editar/listar EPI;
- verificar que usuario nao acessa dados de outra organizacao.

Ao final, responda exatamente:
## Resultado
## Arquivos alterados
## Como testar
## Testes executados
## Pendencias
## Commit
```

