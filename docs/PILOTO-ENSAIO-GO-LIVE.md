# Ensaio de piloto — go-live com cliente real

Roteiro para validar **1 entrega facial completa** por cliente de teste.
Os clientes podem nao ser definitivos; o ensaio e o mesmo.

## Criterio de sucesso

Em cada cliente:

1. Login no **portal** com usuario da empresa.
2. Estoque com saldo no local do cliente.
3. Trabalhador com funcao + consentimento LGPD + face ACTIVE.
4. Uma entrega facial concluida com comprovante imprimivel.

## Checklist por cliente

Use uma linha por cliente (ex.: Cliente A / Cliente B).

| # | Passo | Onde | Cliente A | Cliente B |
|---|---|---|---|---|
| 1 | Cliente `ACTIVE` | Consultoria → Clientes | | |
| 2 | Unidade operacional | Clientes → Unidades | | |
| 3 | Estrutura (setor/funcao/necessidades) ou PGRO | Clientes → Estrutura | | |
| 4 | >=1 trabalhador ACTIVE com funcao | Clientes → Trabalhadores | | |
| 5 | Usuario portal (gestor e/ou op. estoque) | Clientes → Usuarios | | |
| 6 | Login portal ok | `/portal/login` | | |
| 7 | Entrada de estoque (CA + necessidade) | Portal → Estoque | | |
| 8 | Consentimento biometrico GRANTED | Trabalhador / enrollment | | |
| 9 | Template facial ACTIVE | Cadastro facial / link | | |
| 10 | Entrega facial + comprovante | Portal → Entregas | | |
| 11 | Ficha EPI do trabalhador | Portal → Trabalhadores → Ficha | | |
| 12 | Teste no celular | Mesmo fluxo mobile | | |

## Ordem pratica (30–60 min por cliente)

1. **Consultoria:** abrir o cliente e fechar gaps 1–5.
2. **Portal:** entrar com o usuario criado; se `mustChangePassword`, trocar em Conta.
3. **Estoque:** registrar entrada do EPI que a funcao exige.
4. **Face:** gerar link de enrollment ou cadastrar na consultoria.
5. **Entrega:** selecionar trabalhador → EPIs → captura facial → comprovante.
6. **Mobile:** repetir so a entrega no celular.

## Auditoria automatica (banco)

No ambiente com `DATABASE_URL` apontando para o banco certo:

```bash
cd apps/api
npx --yes tsx scripts/audit-pilot-readiness.ts
```

Gera `pilot-audit.json` na raiz com score e falhas por cliente.
Nao imprime CPF nem biometria.

## Separacao Consultoria × Portal (estoque)

- **Consultoria:** catalogo de EPIs (`/epis`) + base CAEPI (`/caepi`). Sem almoxarifado operacional.
- **Portal:** estoque operacional (`/portal/estoque`) com `StockLocation.servedClientId` preenchido.
- Rota legada `/estoque` na Consultoria foi descontinuada (aviso + links). APIs de criacao de local/movimento na Consultoria rejeitam locais sem cliente.

## Compatibilidade necessidade × CA

Ao entrar estoque no portal vinculando necessidade + CA, o sistema **bloqueia** pares incompativeis
(ex.: necessidade "Capacete" + CA 21196 de respirador de jateamento). Escolha um CA da mesma
categoria de protecao.

## Acoes do ensaio InSeg (producao)

| Cliente | Proximo passo |
|---|---|
| **Amendo Healthy** | Portal → Trabalhadores: cadastrar vidas + CPF; gerar **Link facial**; estoque; 1 entrega |
| **Bragametal** | Maria: Editar CPF se faltar → **Link facial** no portal; revisar CA do Capacete se ainda estiver 21196 |
| Ambos | Repetir entrega no **celular** (passo 12) |

Portal agora cobre CRUD de trabalhadores + geracao de link facial (sem depender da Consultoria no dia a dia).

