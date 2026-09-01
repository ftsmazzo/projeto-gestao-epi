---
name: dados-consultoria-inseg
description: Consulta dados da consultoria InSeg no ProntEPI via MCP (empresas, trabalhadores, PGR, EPI, treinamentos, SST). Use quando o usuario mencionar InSeg, ProntEPI, MCP InSeg, carteira de clientes, dados de empresas gerenciadas, ou quiser navegar informacoes SST/EPI de multiplos CNPJs.
---

# Dados Consultoria InSeg (MCP ProntEPI)

## Quando usar

- Perguntas sobre **empresas clientes** da InSeg (CNPJs, cotas, status)
- Trabalhadores, estrutura (setores/cargos), PGR, treinamentos, documentos SST
- Catálogo EPI, CAEPI, estoque da consultoria
- Busca transversal: "qual empresa tem o trabalhador X?"

## Pré-requisito

O servidor MCP `inseg-gestao-epi` deve estar conectado no Claude Teams ou Cursor.

## Fluxo padrão

1. `guia_mcp` — se o usuário não souber o que é possível
2. `consultoria_contexto` — cota e visão geral
3. `listar_empresas` ou `buscar_empresa_ou_trabalhador`
4. `resumo_empresa` → ferramentas específicas

## Regras

- **Sempre** identifique a empresa antes de listar trabalhadores
- CPF vem mascarado — não pedir CPF completo
- **Nunca** expor biometria, fotos, descritores faciais ou tokens de assinatura
- Preferir resumos antes de listas longas
- Responder em português, tom consultor SST

## Mapa rápido de tools

| Necessidade | Tool MCP |
|-------------|----------|
| O que posso fazer? | `guia_mcp` |
| Cota de vidas | `consultoria_contexto` |
| Todas as empresas | `listar_empresas` |
| Achar empresa/pessoa | `buscar_empresa_ou_trabalhador` |
| KPIs de implantação | `resumo_empresa` |
| Colaboradores | `listar_trabalhadores` |
| Setores/cargos | `estrutura_empresa` |
| Treinamentos | `treinamentos_emitidos` |
| Integração/O.S. | `documentos_sst` |
| CA válido? | `consultar_caepi` |

Guia completo para o usuário final: [GUIA-CLAUDE-TEAMS.md](GUIA-CLAUDE-TEAMS.md)
