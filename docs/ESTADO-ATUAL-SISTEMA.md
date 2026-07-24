# Estado atual do sistema — Gestao Digital de EPI

Documento de **onde o sistema esta hoje**, para um GPT/agente retomar o projeto com o mapa mental certo.

**Data:** 2026-07-24  
**Nao e** um prompt de tarefa. E o retrato da arquitetura e do que ja foi entregue.

Leitura complementar (mais antiga / permanente):

- `docs/CURSOR-CONTEXTO.md` — produto, premissas, principios
- `docs/decisions.md` — decisoes (em especial **D08**)
- Blueprints em `docs/blueprints/` — visao e roadmap de longo prazo

---

## 1. Visao em uma frase

A **Consultoria** (tenant) configura e implanta o cliente.  
A **empresa cliente** opera o dia a dia no **Painel do Cliente** (`/portal`).

Sao **duas superficies web**, com login, menu, JWT e APIs separados. Nao misturar.

---

## 2. A mudanca estrutural: duas superficies (D08)

### Antes (modelo antigo na pratica)

Tudo tendia a viver no ambiente da Consultoria: cadastro de cliente, estrutura, trabalhadores, estoque, etc., sob o mesmo login/ops.

### Agora (modelo vigente)

```
┌─────────────────────────────────────┐     ┌─────────────────────────────────────┐
│  CONSULTORIA (implantacao)          │     │  PAINEL DO CLIENTE (operacao)       │
│  Login: /login                      │     │  Login: /portal/login               │
│  Shell: OpsShell                    │     │  Shell: PortalShell                 │
│  JWT audience: consultoria          │     │  JWT audience: client               │
│  Escopo: Organization (tenant)      │     │  Escopo: ServedClient do token      │
│  Rotas: /dashboard, /clientes/...   │     │  Rotas: /portal/*                   │
│         /epis, /caepi, /estoque...  │     │  API: /portal/* + ClientJwtAuthGuard│
└─────────────────────────────────────┘     └─────────────────────────────────────┘
```

### Papel de cada um

| Quem | Faz |
|---|---|
| **Consultoria** | Cadastra cliente (CNPJ), cotas/vidas, PGRO, estrutura (setores/funcoes/riscos/necessidades), base CAEPI, catalogo mestre de EPIs, usuarios do cliente, trabalhadores na implantacao |
| **Painel do Cliente** | Dia a dia da empresa: painel/dashboard, estoque operacional, consulta de estrutura/validade/trabalhadores, conta do gestor/operador; proximos fluxos (entregas, CRUD operacional, etc.) |

### Regras que nao podem ser quebradas

1. Token da Consultoria **nao** abre o portal; token do cliente **nao** abre a Consultoria.
2. Nao embutir `ClientWorkspaceShell` nem rotas `/clientes/[id]` dentro do portal.
3. Estoque/trabalhadores/entregas da Consultoria (telas de gestao) **nao** sao o mesmo produto do painel operacional do cliente — mesmo que o dominio no banco seja compartilhado.
4. Novas features do **cliente** nascem em `/portal/*` + `apps/api/src/portal/`.
5. Novas features de **implantacao** ficam no workspace da Consultoria.

Decisao formal: `docs/decisions.md` → **D08**.

---

## 3. Conceitos de dominio que o codigo usa

| Conceito | Significado |
|---|---|
| **Organization** | Tenant = Consultoria / empresa que contrata o software |
| **ServedClient** | Cliente atendido (empresa com CNPJ) |
| **Vida** | Trabalhador com status `ACTIVE` naquele cliente (consome cota) |
| **OperationalUnit** | Unidade operacional (filial/obra/almoxarifado) |
| **EpiNeed** | Necessidade vinda do PGRO/estrutura (ex.: “Luva de Vaqueta”) — ainda nao e o item com CA |
| **EpiItem** | Item do catalogo com CA, validade, vida util |
| **CaCertificate (CAEPI)** | Base oficial de CAs importada pela Consultoria |
| **StockLocation** | Local de estoque; no portal usa `servedClientId` preenchido (local da empresa). Locais “da Consultoria” ficam com `servedClientId` nulo |

Fluxo tipico de implantacao → operacao:

1. Consultoria cadastra o cliente e aloca vidas.  
2. Importa/revisa PGRO → estrutura e **necessidades**.  
3. Mantem base CAEPI + catalogo de EPIs.  
4. Cria usuarios do cliente (gestor/operador).  
5. Cliente entra no **Painel** e opera (hoje: estoque; em seguida trabalhadores/entregas).

---

## 4. Mapa da Consultoria (estado atual)

Login: `/login` · Navegacao: `OPS_NAV` em `apps/web/src/lib/nav.ts`

| Area | Rotas principais | Situacao |
|---|---|---|
| Dashboard | `/dashboard` | Ativo |
| Clientes | `/clientes`, `/clientes/[id]` | Ativo — overview do cliente |
| Estrutura / PGRO | `/clientes/[id]/estrutura`, importar/atualizar PGRO | Ativo — UX revisada (necessidades agrupadas, sem PGRO duplicado) |
| Trabalhadores (implantacao) | `/clientes/[id]/trabalhadores` | CRUD completo |
| Usuarios do cliente | `/clientes/[id]/usuarios` | Ativo — cria acesso ao portal |
| Unidades | `/clientes/[id]/unidades` | Ativo |
| Catalogo mestre EPIs | `/epis` | Ativo — busca CAEPI preenche cadastro |
| Base CAEPI | `/caepi` | Ativo — importacao/consulta |
| Estoque (gestao Consultoria) | `/estoque` | Existe como tela da Consultoria — **nao** e o estoque do portal |
| Outros | entregas, relatorios, documentos, config | Em graus variados; nao confundir com `/portal` |

Auth/API tipica: JWT consultoria + controllers de dominio (`workers`, `epis`, `caepi`, `served-clients`, etc.).

---

## 5. Mapa do Painel do Cliente (estado atual)

Login: `/portal/login` · Shell: `PortalShell` · Nav: `PORTAL_NAV`

| Rota | O que e | Situacao |
|---|---|---|
| `/portal` | Dashboard (cards do dia a dia) | Ativo — dados via API |
| `/portal/estoque` | Entrada e saldos da empresa | **Operacional** — busca na base CAEPI (igual catalogo), seleciona o EPI comprado, vincula a necessidade; nao digitar CA na mao |
| `/portal/trabalhadores` | Vidas da empresa | **Somente leitura** (lista + cotas). CRUD operacional ainda nao esta no portal |
| `/portal/estrutura` | Leitura da estrutura implantada | Consulta |
| `/portal/validade` | Validades | Consulta / parcial |
| `/portal/entregas` | Entregas | Ainda nao operacional completo (placeholder / base) |
| `/portal/custos` | Custos | Ainda nao operacional completo |
| `/portal/conta` | Conta / troca de senha | Ativo |
| `/portal/login` | Auth do cliente | Ativo |

API dedicada: `apps/api/src/portal/`  
Cliente HTTP: `apps/web/src/lib/client-auth.ts`  
Guard: `ClientJwtAuthGuard` (exige `servedClientId` no token).

Endpoints portal ja existentes (resumo):

- `GET /portal/dashboard`
- `GET /portal/validade`
- `GET /portal/estrutura`
- `GET /portal/trabalhadores`
- `GET /portal/estoque`
- `GET /portal/caepi/search` — mesma base CAEPI do catalogo mestre
- `GET /portal/epis/search`, `GET /portal/epis/by-ca`
- `GET /portal/stock/locations`, `GET /portal/stock/balances`
- `POST /portal/stock/entradas`

---

## 6. O que mudamos nesta fase (resumo narrativo)

### 6.1 Separacao Consultoria × Cliente

- Dois logins, dois shells, dois audiences de JWT.
- Painel do Cliente como produto proprio (`/portal`), nao um submenu dentro de `/clientes/[id]`.
- Usuarios do cliente criados na Consultoria passam a operar no portal.

### 6.2 Painel (dia a dia)

- Menu operacional: Painel, Entregas, Validade, Custos, Estoque, Estrutura, Trabalhadores, Conta.
- Dashboard com cards ligados a APIs reais (nao so mock).
- Estrutura/validade/trabalhadores em modo consulta no portal.

### 6.3 Estoque no portal (ultima frente entregue)

- Local de estoque **por cliente** (`StockLocation.servedClientId`).
- Entrada baseada nas **necessidades** do PGRO + produto real da **base CAEPI**.
- UX alinhada ao Catálogo Mestre: digitar nome → lista de CAs → selecionar o que comprou.
- Backend resolve/cria `EpiItem`, vincula necessidade quando houver, registra entrada.

Ultimo commit dessa frente: `714206a`.

### 6.4 UX de implantacao (Consultoria)

- Estrutura: PGRO sem botao duplicado, necessidades agrupadas por EPI, melhorias de tabela/acoes.
- Removido atalho confuso de “Estrutura” na lista de clientes (fluxo pelo workspace do cliente).

---

## 7. Onde estamos agora (ponto de partida para o proximo chat)

| Frente | Status |
|---|---|
| Auth / tenancy / cotas basicas | Feito |
| Duas superficies (D08) | Feito e vigente |
| Implantacao: cliente, PGRO, estrutura, CAEPI, catalogo, usuarios | Feito (em evolucao) |
| Portal: painel + navegacao | Feito |
| Portal: estoque operacional com CAEPI | Feito |
| Portal: trabalhadores (CRUD do dia a dia) | **Proximo** — hoje so lista |
| Portal: entregas / ficha / biometria | Ainda nao |
| Portal: custos / relatorios ricos | Ainda nao |

Proximo passo natural combinado com o usuario: evoluir **Trabalhadores no Painel do Cliente** (hoje so leitura; na Consultoria o CRUD ja existe em `/clientes/[id]/trabalhadores`).

---

## 8. Arquivos de referencia rapida

```
# Fronteira e nav
docs/decisions.md                          # D08
apps/web/src/lib/nav.ts                    # OPS_NAV vs PORTAL_NAV
apps/web/src/components/PortalShell.tsx
apps/web/src/components/RequireClientAuth.tsx
apps/web/src/lib/client-auth.ts

# Portal API
apps/api/src/portal/portal.controller.ts
apps/api/src/portal/portal.service.ts

# Estoque portal (referencia de UX/API recente)
apps/web/src/app/portal/estoque/page.tsx

# Trabalhadores
apps/web/src/app/portal/trabalhadores/page.tsx          # portal (leitura)
apps/web/src/app/clientes/[id]/trabalhadores/page.tsx   # consultoria (CRUD)
apps/api/src/workers/workers.service.ts

# Dominio
apps/api/prisma/schema.prisma
packages/shared/src/index.ts
```

---

## 9. Como o GPT deve se orientar

1. Antes de codar, confirmar se a tarefa e **Consultoria** ou **Painel do Cliente**.
2. Nao reutilizar telas `/clientes/[id]/*` dentro de `/portal`.
3. No portal, sempre filtrar pelo `servedClientId` do JWT.
4. No estoque do portal, manter busca CAEPI + selecao (nao voltar a “digite o CA”).
5. Para trabalhadores no portal, reaproveitar regras de `WorkersService` (vidas/CPF), expondo via `/portal/*`.
