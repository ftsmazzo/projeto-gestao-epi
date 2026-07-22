# Contexto para Cursor - Gestao Digital de Entrega de EPI

## 1. Produto

Estamos construindo uma plataforma de gestao digital de EPI para empresas que precisam entregar, rastrear, auditar e controlar Equipamentos de Protecao Individual sem depender de papel.

O produto deve unir:

- fluxo rapido de entrega no almoxarifado;
- identificacao do trabalhador;
- assinatura/biometria como evidencia;
- ficha eletronica aderente a NR-06;
- estoque com lote, CA, validade e movimentacoes;
- devolucao, troca e pendencias;
- planejamento por vida util, cargo, area, GHE e validade;
- relatorios para auditoria;
- integracoes futuras com ERP, HCM e eSocial.

## 2. Benchmark consolidado

As referencias analisadas indicam estes aprendizados:

- Nexus: liberacao automatica por funcao/perfil e entrega por reconhecimento facial.
- SGG: ficha eletronica, QR Code, biometria, alertas de validade e aderencia NR-6.
- OnSafety: fluxo mobile simples: trabalhador, EPI, salvar entrega, biometria facial.
- EntregaEPI: solucao mais ampla com offline, estoque em transito, planejamento, aprovacoes, devolucoes, treinamentos e relatorios.
- Prisma/Senior: fluxo corporativo gestor -> requisicao/RM -> retirada facial -> registro no HCM/ERP.

## 3. Direcao do produto

Queremos uma solucao completa, mas a execucao deve ser incremental.

O MVP nao deve tentar implementar tudo de uma vez. A ordem segura e:

1. fundacao tecnica;
2. autenticacao e tenancy;
3. cadastros mestres;
4. entrega simples e ficha eletronica;
5. estoque basico;
6. assinatura e consentimento;
7. biometria facial via adapter;
8. devolucao/troca;
9. relatorios;
10. aprovacoes, offline e integracoes.

## 4. Premissas tecnicas iniciais

Estas premissas podem ser ajustadas antes do primeiro bootstrap:

- Web admin: Next.js/React.
- API: Node.js com NestJS ou stack equivalente bem estruturada.
- Banco: PostgreSQL.
- ORM/migrations: Prisma, se stack Node for usada.
- Filas/cache: Redis em fase posterior.
- Storage de evidencias: S3-compatible em fase posterior.
- Deploy: EasyPanel como preferencia operacional.
- Biometria: adapter/SDK externo; nao desenvolver reconhecimento facial proprio no MVP.

## 5. Principios obrigatorios

- Nao apagar historico de ficha; corrigir por evento auditado.
- Nao logar dados biometricos brutos.
- Nao expor segredos em codigo ou documentacao.
- Nao permitir vazamento entre empresas/tenants.
- Nao concluir entrega sem evidencia configurada.
- Nao misturar app offline, biometria real e integracao ERP no bootstrap.
- Criar migrations apenas quando schema mudar.
- Preservar healthcheck e scripts de validacao.

## 6. Perfis previstos

- Admin da plataforma.
- Admin da empresa.
- Gestor de seguranca/SESMT.
- Almoxarife/entregador.
- Lider/gestor solicitante.
- Auditor.
- Trabalhador/colaborador, em app/portal futuro.

## 7. Fluxo principal futuro

1. Empresa cadastra unidades, areas, cargos e usuarios.
2. Trabalhadores sao cadastrados/importados.
3. EPIs sao cadastrados com CA, validade, vida util e variacoes.
4. Estoque recebe entradas por lote/local.
5. Operador inicia entrega.
6. Sistema valida trabalhador, regra de EPI, estoque e prazo.
7. Trabalhador confirma por assinatura, senha ou biometria.
8. Sistema gera ficha eletronica, baixa estoque e registra auditoria.
9. Relatorios mostram entregas, pendencias, vencimentos e estoque.

## 8. Formato esperado de resposta do Cursor

Ao final de cada subetapa, responder exatamente:

```markdown
## Resultado
## Arquivos alterados
## Como testar
## Testes executados
## Pendencias
## Commit
```

