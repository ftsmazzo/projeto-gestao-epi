# KB Agente Interno V2

Versao: `v2-2026-09-16`  
Agente: `agente-unico-prontepi`

## Objetivo

Esta base sustenta o agente interno unico do ProntEPI para os dois niveis:

- Consultoria (implantacao e governanca)
- Cliente (operacao diaria no portal)

## Estrutura

- Fonte principal: `apps/api/src/support/kb/support-kb.v2.ts`
- Manifesto versionado: `apps/api/src/support/kb/support-kb.v2.json`
- Motor de busca/ranqueamento: `apps/api/src/support/support-knowledge.ts`

## Composicao da base

- Entradas globais: `6`
- Entradas especiais (casos criticos): `3`
- Modulos operacionais: `22`
- Entradas por modulo: `4`
- Total de entradas KB V2: `97`

Cada modulo gera 4 tipos de resposta:

1. Como operar
2. Checklist
3. Erros comuns
4. Indicadores/KPIs

## Regras de priorizacao

1. Filtro de escopo (`CONSULTORIA`, `CLIENTE`, `BOTH`)
2. Match por rota atual (com suporte a rotas dinamicas como `[id]`)
3. Match semantico por titulo, pergunta, resposta, passos, avisos e tags

## Boas praticas de manutencao

- Nao misturar orientacao de consultoria em respostas de cliente.
- Sempre incluir rota quando houver tela especifica.
- Incluir checklist curto para fluxos com alto risco operacional.
- Registrar erros recorrentes (warnings) para prevenir retrabalho.
- Manter linguagem direta e operacional.

## Evolucao sugerida (V3)

- Base de troubleshooting por codigo de erro/API.
- Ferramenta de feedback por resposta (util / nao util).
- Curadoria automatica de novas duvidas frequentes.
