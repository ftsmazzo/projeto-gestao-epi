# Playbook SAC — Painel do Cliente (ProntEPI)

Documento para **agente de atendimento** (humano ou LLM). Objetivo: resolver o chamado no portal sem misturar com a Consultoria.

**Manual visual (HTML):** `docs/manuais/portal-cliente-manual.html`  
**Produto:** ProntEPI · Painel do Cliente · `/portal/login`  
**Atualizado:** 2026-08-05  

Nao armazenar senhas neste playbook.

---

## Snapshot do piloto (Bragametal · 2026-08-05)

Usado para calibrar respostas. Dados mudam; tratar como exemplo, nao como verdade eterna.

| Campo | Valor observado |
|---|---|
| Empresa | Bragametal Esquadrias Metalicas Ltda |
| CNPJ | 65.639.056/0001-36 |
| Consultoria | InSeg |
| Usuario exemplo | Tadeu Mazzo · `CLIENT_MANAGER` · e-mail de teste |
| Cota | 2 / 20 vidas |
| Estrutura | 1 unidade (Matriz), 4 setores, 6 funcoes, 8 necessidades |
| Estoque | 68 unidades · 13 linhas · local “Estoque principal” |
| Validade CA | 1 vencido (Protetor facial CA 44809, 20/09/2025) · 12 em dia |
| Trabalhadores | Joao Souza (Face ok, 4 trocas vencidas) · Maria Silva (Sem face) |
| Entregas 7 dias | 0 (ha historico, ex. ENT-20260728-0003) |
| Relatorios ~30d | 3 entregas · 10 itens · sem gaps de cobertura/estoque |
| Custos | Modulo “em breve” |

Observacao de qualidade: entrega ENT-20260728-0003 vinculou CA 21196 (respirador de jateamento) a necessidade “Capacete”. Entradas novas agora bloqueiam esse mismatch; estoque/historico antigo pode ainda mostrar o CA errado.

---

## 0. Identidade e fronteira

| Campo | Valor |
|---|---|
| Superficie | Painel do Cliente |
| Login correto | `/portal/login` |
| Login errado (nao e este produto) | `/login` = Consultoria |
| Escopo do usuario | Uma empresa (CNPJ / servedClient) por sessao |
| Idioma das mensagens no sistema | PT sem acento na maior parte das strings |

**Regra de ouro:** se o pedido e implantacao (PGRO, cota, usuario novo, CAEPI, catalogo mestre, revogar biometria), **escalar para Consultoria**. Se e operacao do dia (estoque, vida, entrega, relatorio), **resolver no portal**.

---

## 1. Classificacao do chamado

Pergunte sempre:

1. A pessoa entra em `/portal/login` ou `/login`?
2. Qual empresa (nome / CNPJ)?
3. Qual e-mail do usuario?
4. O que tentou fazer (tela + passo)?
5. Qual mensagem de erro (texto exato)?

Intencoes:

| intent | Exemplos | Destino |
|---|---|---|
| `auth.login` | nao entra, senha invalida | Portal / reset |
| `auth.password_reset` | esqueci senha, senha temporaria | `/esqueci-senha?origem=portal` |
| `auth.must_change_password` | pede trocar senha e trava | `/portal/conta?obrigatorio=1` |
| `stock.entrada` | nao acha CA, entrada falha | Estoque |
| `stock.ca_mismatch` | CA nao combina com necessidade | Estoque + orientar CA correto |
| `workers.crud` | cadastrar / editar / inativar | Trabalhadores |
| `workers.csv` | importar planilha | Trabalhadores → Importar CSV |
| `workers.quota` | sem vaga de vida | Escalar Consultoria (cota) |
| `workers.face_link` | gerar link facial | Trabalhadores + CPF |
| `enroll.facial` | link do trabalhador, camera | Pagina publica `/enroll/facial/{token}` |
| `delivery.create` | entrega / troca | Entregas |
| `delivery.no_stock` | sem saldo | Estoque primeiro |
| `delivery.no_face` | sem template | Link facial primeiro |
| `delivery.face_mismatch` | face nao bate | Retry / recadastro |
| `reports.export` | CSV / imprimir | Relatorios |
| `structure.read` | ver setor/funcao | Estrutura (somente leitura) |
| `costs` | custo / preco | Informar: ainda nao disponivel |
| `consultoria.*` | PGRO, usuario, CAEPI global | Escalar |

---

## 2. Scripts curtos

### 2.1 Login

> Voce precisa do **Portal do cliente**, nao do login da consultoria.  
> Abra `/portal/login`, use o e-mail que a consultoria cadastrou.  
> Se a senha for temporaria, o sistema manda trocar em **Minha conta**.

### 2.2 Esqueci a senha

> Em `/portal/login` clique em **Esqueci a senha**.  
> Informe o e-mail. Se o envio automatico estiver desligado no piloto, a **senha temporaria aparece na tela** — copie e entre de novo.  
> No primeiro acesso, troque a senha.

### 2.3 Cota de vidas esgotada

> Cada trabalhador **ativo** consome 1 vida da franquia da empresa.  
> Inative quem saiu ou peca a consultoria para aumentar a cota.

### 2.4 CA incompativel

> O CA precisa ser do **mesmo tipo de protecao** da necessidade.  
> Capacete de cabeca nao aceita CA de respirador de jateamento (ex.: CA 21196).  
> Busque na CAEPI um certificado cujo nome seja realmente capacete (ou luva, etc.).

### 2.5 Sem face na entrega

> Em **Trabalhadores**, confirme o CPF e clique em **Link facial**.  
> Envie o link (24h). O trabalhador informa os 4 ultimos digitos do CPF, aceita o termo e captura o rosto.  
> Depois volte em **Entregas**.

---

## 3. Fluxos oficiais (passo a passo)

### 3.1 Entrada de estoque

1. Portal → Estoque → aba Entrada  
2. Selecionar necessidade **ou** buscar EPI na CAEPI  
3. Escolher o CA correto  
4. Quantidade → confirmar  
5. Conferir aba Saldos  

Falhas tipicas:

| Mensagem / sintoma | Causa | Acao SAC |
|---|---|---|
| CA nao encontrado na base | CAEPI desatualizada | Escalar Consultoria (atualizar base) |
| CA nao combina com a necessidade | Categoria diferente | Orientar outro CA |
| Necessidade sem EPI / varios EPIs | Falta CA ou ha ambiguidade | Informar o CA certo |
| Sem vinculo para movimentacao | Usuario portal sem userId interno | Escalar Consultoria |

### 3.2 Cadastrar trabalhador

1. Trabalhadores → Novo trabalhador  
2. Nome obrigatorio; setor/funcao obrigatorios se houver estrutura  
3. Salvar  
4. Se precisar de entrega facial: CPF + Link facial  

CSV:

1. Importar CSV → baixar modelo  
2. Unidade/setor/funcao **ja existentes** (texto igual ao cadastro)  
3. Revisar previa (erros, cota) → confirmar  

### 3.3 Entrega facial

Pre-requisitos:

- Trabalhador ACTIVE com funcao  
- Face valida  
- Estoque com saldo do EPI da necessidade  
- Consentimento/template ok  

Passos: Entregas → trabalhador → EPIs → biometria → confirmar → comprovante/imprimir.

### 3.4 Relatorios

- Filtros → Aplicar  
- Abas: visao geral, trocas, entregas, atividade, estoque, devolucoes, cobertura  
- Exportar CSV / Imprimir  

---

## 4. Arvore de troubleshooting

```
Nao entra no sistema?
├─ URL e /login ? → redirecionar para /portal/login
├─ E-mail errado / usuario so da consultoria? → escalar Consultoria
├─ Senha esquecida? → reset portal
├─ Pede troca de senha e nao sai? → /portal/conta?obrigatorio=1
└─ Conta inativa / cliente inativo? → escalar Consultoria

Nao consegue entregar?
├─ Sem face? → link facial + CPF
├─ Face falha? → luz/camera; se persistir, recadastro (Consultoria revoga)
├─ Sem estoque? → entrada com CA
├─ Sem EPI vinculado a necessidade? → entrada naquela necessidade
├─ Trabalhador inativo / sem funcao? → editar/ativar no portal
└─ Sem cota para ativar? → escalar Consultoria

Importacao CSV falha?
├─ Colunas diferentes do modelo? → baixar modelo de novo
├─ Setor/funcao nao existem? → conferir Estrutura (so leitura) e pedir PGRO a Consultoria se faltar
├─ Excede cota? → inativar vidas ou escalar cota
└─ CPF/matricula duplicados? → corrigir planilha (vira update se bater CPF/matricula)
```

---

## 5. FAQ rapido (respostas curtas)

**P: Por que nao cadastro o cliente no portal?**  
R: Cliente/CNPJ e implantacao da Consultoria.

**P: Posso alterar o PGRO?**  
R: Nao. Estrutura e somente leitura. Consultoria importa/atualiza.

**P: Onde fica o estoque da consultoria?**  
R: Nao existe almoxarifado operacional na Consultoria. Estoque e no portal da empresa.

**P: Custos nao abre nada util.**  
R: Correto no piloto. Sem precificacao no sistema ainda. Use Relatorios para volume.

**P: Link facial expirou.**  
R: Gere outro no portal (24h). Precisa de CPF.

**P: Ja tem face e preciso trocar a foto.**  
R: Portal nao revoga. Consultoria revoga biometria e depois gera novo link.

**P: Imprimir comprovante no celular.**  
R: Abrir a entrega → Imprimir/PDF do navegador.

**P: Dois logins com o mesmo e-mail?**  
R: Consultoria e portal sao sessoes diferentes. Usar a porta certa.

---

## 6. Escalacao para Consultoria

Enviar com:

- Empresa + CNPJ  
- E-mail do usuario portal  
- Intent (`consultoria.pgro`, `consultoria.quota`, `consultoria.user`, `consultoria.caepi`, `consultoria.biometrics_revoke`, `consultoria.catalog`)  
- O que ja foi tentado no portal  
- Print ou texto do erro  

Nao pedir ao SAC para “criar estoque na consultoria” nem “resetar face sem revogar”.

---

## 7. Glossario curto

| Termo | Significado |
|---|---|
| Vida | Trabalhador ACTIVE (consome cota) |
| Necessidade (EpiNeed) | Item exigido pela funcao / PGRO (ex. “Luva”) |
| EPI real (EpiItem) | Item com CA no catalogo |
| CA / CAEPI | Certificado de Aprovacao oficial |
| Template facial | Descritor biometrico do trabalhador |
| Recibo | Comprovante da entrega concluida |

---

## 8. Fonte de verdade para o agente

1. Este playbook (procedimento e fronteira)  
2. Manual HTML (telas e jornada)  
3. Codigo vivo: `apps/web/src/app/portal/**`, `apps/api/src/portal/**`, `PORTAL_NAV` em `apps/web/src/lib/nav.ts`  
4. Nao inventar tela de custos, edicao de PGRO no portal, nem estoque na Consultoria.

Quando o codigo mudar, atualizar este arquivo e o HTML juntos.
