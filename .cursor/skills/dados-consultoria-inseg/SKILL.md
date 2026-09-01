---
name: dados-consultoria-inseg
description: Consulta dados da consultoria InSeg no ProntEPI via MCP (empresas, trabalhadores, PGR, EPI, treinamentos, SST). Use quando o usuario mencionar InSeg, ProntEPI, MCP InSeg, Ultrarapida, soldadores, carteira de clientes, dados de empresas gerenciadas, ou quiser navegar informacoes SST/EPI de multiplos CNPJs.
---

# Dados Consultoria InSeg (MCP ProntEPI)

## Quando usar

- Perguntas sobre **empresas clientes** da InSeg (CNPJs, cotas, status)
- Trabalhadores por cargo (ex.: **soldadores**), estrutura, PGR, treinamentos
- Busca por nome: **Ultrarapida**, CNPJ, ou trabalhador em toda carteira
- Catálogo EPI, CAEPI, estoque, documentos SST

## Pré-requisito

Conector MCP `inseg-gestao-epi` conectado (Claude Teams ou Cursor).

**Claude Teams:** a UI pode mostrar "sem ferramentas" — ignore; invoque tools na conversa.

Guia detalhado para Teams: [SKILL-CLAUDE-TEAMS.md](SKILL-CLAUDE-TEAMS.md)

## Fluxo padrão

1. `buscar_empresa_ou_trabalhador` — achar empresa/pessoa pelo nome
2. `resumo_empresa` — KPIs de implantação
3. Tool específica (`listar_trabalhadores`, `documentos_sst`, etc.)

## Exemplos

| Pergunta | Ação |
|----------|------|
| "Dados da Ultrarapida" | `buscar_empresa_ou_trabalhador` → `resumo_empresa` |
| "Soldadores da Ultrarapida" | buscar empresa → `listar_trabalhadores` → filtrar cargo |
| "Cota de vidas" | `consultoria_contexto` |

## Regras

- **Sempre** identifique a empresa antes de listar trabalhadores
- **Nunca** invente dados — use tools MCP
- CPF mascarado; sem biometria/tokens
- Responder em português

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

Guia de conexão: [GUIA-CLAUDE-TEAMS.md](GUIA-CLAUDE-TEAMS.md)
