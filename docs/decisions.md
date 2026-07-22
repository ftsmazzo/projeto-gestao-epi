# Decisoes Iniciais do Projeto

## Status

Documento vivo. As decisoes abaixo sao premissas de produto e dominio. Novas decisoes estruturais devem ser registradas aqui antes de impactar auth, tenancy ou cadastros.

## D01 - Produto como SaaS multiempresa

Decisao:
Planejar o produto como SaaS multiempresa desde a base.

Motivo:
O dominio tende a atender varias empresas, unidades, obras e CNPJs. Adiar tenancy costuma gerar retrabalho alto em seguranca, relatorios e banco.

Impacto:
Toda entidade operacional deve carregar `organizationId` ou equivalente.

## D02 - MVP web + API antes de app mobile

Decisao:
Iniciar por web admin e API. App mobile/offline vira epico posterior.

Motivo:
Permite validar modelo de dominio, cadastros, ficha, estoque e entrega antes da complexidade de sincronizacao offline.

Impacto:
O primeiro fluxo de entrega pode ser web responsivo. O app deve ser planejado, mas nao codado no bootstrap.

## D03 - Biometria por adapter, nao reconhecimento proprio

Decisao:
Tratar biometria facial como integracao/adaptador.

Motivo:
Reconhecimento facial exige liveness, seguranca, LGPD, performance e evidencias. Desenvolver isso do zero cedo demais aumenta risco.

Impacto:
No inicio pode existir provider mockado para desenhar fluxo. Provider real sera escolhido depois.

## D04 - Estoque proprio no produto

Decisao:
Criar modulo de estoque proprio no produto, com integracao ERP posterior.

Motivo:
As referencias mais completas usam estoque como parte central da entrega. Depender de ERP desde o MVP travaria implantacoes.

Impacto:
Entrega deve baixar estoque interno. ERP deve receber/fornecer eventos em etapa posterior.

## D05 - Ficha eletronica baseada em eventos

Decisao:
Modelar a ficha de EPI como historico de eventos, nao como PDF editavel.

Motivo:
Auditoria exige rastreabilidade. PDF deve ser exportacao, nao fonte de verdade.

Impacto:
Cancelamento e ajuste devem gerar eventos, nao apagar historico.

## D06 - EasyPanel como preferencia operacional

Decisao:
Considerar EasyPanel como preferencia de deploy, salvo restricao futura.

Motivo:
E alinhado ao padrao operacional do usuario e simplifica API, web, banco e serviços auxiliares.

Impacto:
Dockerfiles, variaveis, healthchecks e migrations devem ser pensados desde cedo.

## D07 - Franquia total de vidas e cotas por cliente atendido

Decisao:
A empresa usuaria do software (tenant) contrata uma franquia total de vidas e distribui cotas dessa franquia entre seus clientes atendidos. Tenant, cliente atendido e unidade operacional sao entidades distintas.

Definicoes:

- **Empresa usuaria / tenant / Organization**: quem assina o software e e a fronteira principal de tenancy.
- **Cliente atendido**: cliente da empresa usuaria, normalmente identificado por CNPJ; nao e o tenant.
- **Unidade operacional**: unidade/filial/obra da estrutura operacional; nao substitui cliente atendido.
- **Vida**: trabalhador ativo vinculado a um cliente atendido.

Controle obrigatorio de cotas:

- vidas contratadas (franquia total do tenant);
- vidas alocadas (soma das cotas distribuidas aos clientes atendidos);
- vidas usadas (trabalhadores ativos contabilizados);
- vidas disponiveis (contratadas menos usadas, ou conforme regra operacional definida na implementacao).

Motivo:
O modelo comercial e operacional nao e apenas multiempresa simples. A empresa usuaria presta servico a varios clientes e precisa limitar capacidade por franquia e por cota.

Impacto:

- Auth/tenancy devem modelar `Organization` como assinante, nao como cliente atendido.
- Cadastros devem prever `ServedClient` (ou equivalente) separado de `Unit`/`Area`.
- Trabalhador ativo deve consumir cota do cliente atendido e da franquia do tenant.
- Relatorios e painel administrativo devem expor contratadas, alocadas, usadas e disponiveis.
- Implementacao de cotas pode entrar depois do bootstrap, mas o modelo de dados nao deve colapsar essas entidades.

