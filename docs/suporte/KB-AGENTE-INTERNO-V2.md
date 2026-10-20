# KB Agente Interno V2

Versao: `v2-2026-10-20`  
Agente: `agente-unico-prontepi`

## Objetivo

Esta base sustenta o agente interno unico do ProntEPI para tres niveis:

- Consultoria (implantacao e governanca)
- Cliente (operacao diaria no portal)
- Distribuidora (deposito, compras, orcamentos e fiscal do ERP)

## Estrutura

- Fonte principal: `apps/api/src/support/kb/support-kb.v2.ts`
- Manifesto versionado: `apps/api/src/support/kb/support-kb.v2.json`
- Motor de busca/ranqueamento: `apps/api/src/support/support-knowledge.ts`

## Composicao da base

- Entradas globais: `8` (6 BOTH + 2 DISTRIBUIDORA)
- Entradas especiais (casos criticos): `4`
- Modulos operacionais: `33` (22 consultoria/cliente + 11 distribuidora)
- Entradas por modulo: `4`
- Total de entradas KB V2: `144` (aprox.)

Cada modulo gera 4 tipos de resposta:

1. Como operar
2. Checklist
3. Erros comuns
4. Indicadores/KPIs

## Regras de priorizacao

1. Filtro de escopo (`CONSULTORIA`, `CLIENTE`, `DISTRIBUIDORA`; `BOTH` so para consultoria/cliente)
2. Match por rota atual (com suporte a rotas dinamicas como `[id]`)
3. Match semantico por titulo, pergunta, resposta, passos, avisos e tags

## Boas praticas de manutencao

- Nao misturar orientacao de consultoria em respostas de cliente ou distribuidora.
- Sempre incluir rota quando houver tela especifica (`[Nome](/caminho)`).
- Incluir checklist curto para fluxos com alto risco operacional.
- Registrar erros recorrentes (warnings) para prevenir retrabalho.
- Manter linguagem direta e operacional.
- Na Distribuidora, nao prometer autorizacao SEFAZ ate homologacao.

## Evolucao sugerida (V3)

- Base de troubleshooting por codigo de erro/API.
- Ferramenta de feedback por resposta (util / nao util).
- Curadoria automatica de novas duvidas frequentes.
