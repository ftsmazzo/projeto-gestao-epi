# MCP InSeg — ProntEPI

Servidor MCP para a consultoria InSeg consultar dados de todas as empresas gerenciadas no Gestão EPI.

## Arquitetura

```
Claude Teams  →  apps/mcp-inseg (MCP HTTP :3100)  →  API /mcp/v1/*  →  PostgreSQL
```

## Variáveis de ambiente

### API (`gestao-epi/api`)

| Variável | Descrição |
|----------|-----------|
| `MCP_API_KEY` | Chave secreta compartilhada com o servidor MCP |
| `MCP_ORGANIZATION_ID` | ID da organização InSeg **ou** |
| `MCP_ORGANIZATION_SLUG` | Slug da organização (ex.: `inseg`) |

### MCP (`gestao-epi/mcp-inseg`)

| Variável | Descrição |
|----------|-----------|
| `GESTAO_EPI_API_URL` | URL interna da API (ex.: `http://gestao-epi_api:3001`) |
| `MCP_API_KEY` | Mesma chave da API (para chamar `/mcp/v1/*`) |
| `MCP_PUBLIC_KEY` | Chave que o Claude Teams envia no Bearer (pode ser igual à `MCP_API_KEY`) |
| `MCP_PORT` | Porta HTTP (padrão `3100`) |

## Deploy EasyPanel

Serviço: `mcp-inseg` no projeto `gestao-epi`

- Dockerfile: `apps/mcp-inseg/Dockerfile`
- Domínio sugerido: `gestao-epi-mcp-inseg.kxryyk.easypanel.host`
- Path MCP: `POST /mcp`
- Health: `GET /health`

## Gerar chave

```bash
openssl rand -hex 32
```

Use o mesmo valor em `MCP_API_KEY` (API + MCP) e `MCP_PUBLIC_KEY` (MCP, Bearer do Claude).

## Guia do usuário

Ver [.cursor/skills/dados-consultoria-inseg/GUIA-CLAUDE-TEAMS.md](../.cursor/skills/dados-consultoria-inseg/GUIA-CLAUDE-TEAMS.md)
