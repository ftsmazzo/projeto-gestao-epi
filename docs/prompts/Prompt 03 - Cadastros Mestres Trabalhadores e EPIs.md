# Prompt 03 - Cadastros Mestres Trabalhadores e EPIs

Use este prompt somente depois de auth e tenancy estarem aprovados.

```markdown
Leia primeiro:
- README.md
- docs/CURSOR-CONTEXTO.md
- docs/decisions.md
- docs/blueprints/Blueprint 01 - Catalogo Rico de Funcoes do Software de Entrega de EPI.md
- docs/blueprints/Blueprint 04 - Modelo de Dados e Fronteiras de Dominio.md
- docs/blueprints/Blueprint 06 - UX Operacional e Mapa de Telas.md

Execute apenas o Epico 02 - Cadastros mestres, em recorte inicial.

Objetivo:
Criar os cadastros basicos necessarios para preparar a futura entrega de EPI: clientes atendidos, unidades/areas, trabalhadores e EPIs, respeitando franquia e cotas de vidas.

Implemente:
- CRUD basico de clientes atendidos (`ServedClient`), normalmente com CNPJ;
- campos ou controle basico de cotas de vidas por cliente atendido;
- visibilidade basica de vidas contratadas, alocadas, usadas e disponiveis no tenant;
- CRUD basico de unidades;
- CRUD basico de areas;
- CRUD basico de trabalhadores vinculados a um cliente atendido;
- CRUD basico de EPIs;
- campos essenciais de CA, validade, vida util e status;
- filtros simples por status, unidade e cliente atendido;
- telas web correspondentes;
- auditoria basica de criacao/alteracao.

Premissa estrutural obrigatoria (D07):
- empresa usuaria/tenant assina o software e possui franquia total de vidas;
- cliente atendido e cliente da empresa usuaria, distinto do tenant e da unidade operacional;
- vida = trabalhador ativo vinculado a um cliente atendido;
- o sistema deve controlar vidas contratadas, alocadas, usadas e disponiveis.

Regras:
- Nao implementar estoque ainda.
- Nao implementar entrega ainda.
- Nao implementar biometria.
- Nao implementar importacao por planilha.
- Nao implementar relatorios avancados.
- Todos os dados devem respeitar organization/tenant.
- Nao tratar tenant, cliente atendido e unidade operacional como a mesma entidade.
- Trabalhador ativo deve consumir cota/vida do cliente atendido.
- Criar migrations necessarias.
- Preservar fluxos de login e dashboard.
- Fazer commit e push.

Testes obrigatorios:
- typecheck;
- build;
- migrations;
- criar/editar/listar cliente atendido;
- criar/editar/listar unidade;
- criar/editar/listar trabalhador vinculado a cliente;
- criar/editar/listar EPI;
- verificar consumo basico de cota/vidas ao ativar trabalhador;
- verificar que usuario nao acessa dados de outra organizacao.

Ao final, responda exatamente:
## Resultado
## Arquivos alterados
## Como testar
## Testes executados
## Pendencias
## Commit
```
