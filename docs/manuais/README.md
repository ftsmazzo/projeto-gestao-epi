# Manuais — ProntEPI

| Arquivo | Uso |
|---|---|
| [portal-cliente-manual.html](./portal-cliente-manual.html) | Manual completo do **Painel do Cliente** (abrir no navegador / imprimir PDF). Inclui visoes ilustradas das telas. |
| [portal-cliente-sac.md](./portal-cliente-sac.md) | Playbook para **agente de SAC** (humano ou LLM): intents, scripts, troubleshooting e escalacao. |

## Capacidade de acesso (agente de desenvolvimento)

- **Paginas publicas** (ex.: `/portal/login`): acessiveis por fetch.
- **Painel autenticado**: login JWT do cliente. Prints reais estao em `screenshots/` (piloto Bragametal, 05/08/2026).
- Recapturar: defina `PORTAL_EMAIL` e `PORTAL_PASSWORD` no ambiente e rode `node docs/manuais/scripts/capture-portal-screens.mjs` (depois de `npm install` em `docs/manuais/scripts`).
- **Nunca** commitar senha, token ou `.env`.
