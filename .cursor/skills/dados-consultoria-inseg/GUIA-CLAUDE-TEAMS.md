# Guia InSeg MCP — Claude Teams

Conecte o **ProntEPI Gestão EPI** ao Claude Teams para consultar, em linguagem natural, os dados de **todas as empresas** que a InSeg gerencia.

## O que você pode fazer

### Visão da consultoria
- Ver cota de vidas contratada, alocada, usada e disponível
- Listar todas as empresas (CNPJs) ativas e inativas
- Ver grupos empresariais (holdings / grupos de CNPJs)

### Por empresa
- **Resumo de implantação**: unidades, trabalhadores, setores, funções, riscos PGR, estoque, último import PGRO, usuários do portal
- **Trabalhadores**: nome, setor, cargo, status, se tem cadastro facial (sem expor biometria)
- **Estrutura**: unidades operacionais, setores e cargos
- **Estoque** do cliente (resumo de saldos)

### Transversal (todas as empresas)
- **Buscar** empresa por razão social ou CNPJ
- **Buscar** trabalhador por nome em toda a carteira
- **Treinamentos** emitidos (certificados/turmas)
- **Documentos SST** (integração, ordem de serviço) — status e pendências
- **Catálogo EPI** e necessidades cadastradas
- **Consultar CAEPI** por número de CA

### Exemplos de perguntas

| Pergunta | O que o Claude faz |
|----------|-------------------|
| "Quantas vidas a InSeg ainda tem disponíveis?" | `consultoria_contexto` |
| "Liste minhas empresas ativas" | `listar_empresas` |
| "Como está a implantação da Dedetizadora Catanduva?" | busca → `resumo_empresa` |
| "Quem são os trabalhadores da empresa X?" | `listar_trabalhadores` |
| "Tem integração SST pendente?" | `documentos_sst` com status |
| "O CA 12345 está válido?" | `consultar_caepi` |
| "O que você consegue consultar?" | `guia_mcp` |

## O que **não** está disponível (por segurança)

- Fotos e descritores biométricos faciais
- Links públicos de assinatura ou cadastro facial
- Senhas e credenciais de portal
- Dados de outras consultorias
- Alteração de dados (MCP é **somente leitura**)

## Conectar no Claude Teams

O Claude Teams **exige OAuth** em servidores MCP remotos. Nosso servidor suporta **registro automático de cliente** — não é necessário colar OAuth Client ID manualmente.

1. Peça ao administrador do Claude Teams para adicionar um **conector MCP personalizado**
2. Configure:

| Campo | Valor |
|-------|-------|
| **URL do servidor** | `https://gestao-epi-mcp-inseg.kxryyk.easypanel.host/mcp` |
| **Cliente OAuth** | **Sem ID de cliente — registrar automaticamente** |
| **Autenticação** | OAuth (detectado automaticamente) |

3. Ao salvar/conectar, o Claude abrirá uma **página de login InSeg**
4. Cole a **chave de acesso InSeg** e clique em **Autorizar conexão**
5. Teste: *"Use guia_mcp e me diga o que você consegue consultar"*

### “Este conector não possui ferramentas disponíveis”

Isso pode aparecer na **tela de configuração** — ignore. O servidor expõe **16 tools**; elas funcionam **no chat**, não nessa URL.

### Claude diz “não tenho ferramentas ativas nesta conversa”

O conector está **conectado na conta**, mas precisa estar **ligado neste chat**:

1. Abra uma **conversa nova** (importante — chats antigos não recebem tools)
2. Clique no **+** (ou ícone de plug/conectores) **no campo de mensagem**
3. Ative o conector **ProntEPI / InSeg**
4. Confirme que aparece um badge/chip do conector acima do input
5. Teste com texto explícito:

   *“Use a tool `buscar_empresa_ou_trabalhador` com consulta Ultrarapida e me mostre o resultado.”*

Se usar **Projeto** no Claude Teams, vincule o conector MCP **nas configurações do Projeto** e abra o chat **dentro des desse Projeto**.

### Skill / instruções do projeto (recomendado)

Cole em **Instruções do projeto** o arquivo `SKILL-CLAUDE-TEAMS.md` — ensina buscar Ultrarapida, listar soldadores, etc.

### Erro “Não foi possível registrar no serviço de login”

Esse erro (`ofid_…`) ocorria porque o servidor ainda **não tinha OAuth**. Após o deploy:

1. Remova o conector antigo
2. Crie de novo com **registrar automaticamente**
3. Complete o login na página InSeg com a chave de acesso

### Alternativa: cabeçalho fixo (Cursor)

Se o Teams não permitir OAuth, use no **Cursor** com cabeçalho `x-api-key` ou `Authorization: Bearer` (seção abaixo).

## Conectar no Cursor (opcional)

Arquivo `.cursor/mcp.json` (ou Settings → MCP):

```json
{
  "mcpServers": {
    "inseg-gestao-epi": {
      "url": "https://gestao-epi-mcp-inseg.kxryyk.easypanel.host/mcp",
      "headers": {
        "Authorization": "Bearer SUA_CHAVE_AQUI"
      }
    }
  }
}
```

## Lista completa de Tools

1. `guia_mcp` — este guia resumido
2. `consultoria_contexto`
3. `listar_empresas`
4. `buscar_empresa_ou_trabalhador`
5. `detalhe_empresa`
6. `resumo_empresa`
7. `listar_trabalhadores`
8. `estrutura_empresa`
9. `listar_grupos_empresariais`
10. `catalogo_epi`
11. `necessidades_epi`
12. `consultar_caepi`
13. `treinamentos_emitidos`
14. `documentos_sst`
15. `estoque_consultoria`
16. `estoque_empresa`

## Suporte

- Dúvidas de **uso do ProntEPI** (portal, entregas): agente Nilo no WhatsApp
- Dúvidas de **acesso MCP**: equipe técnica InSeg / FabriaIA
