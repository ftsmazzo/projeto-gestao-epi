import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet } from './api-client.js';

const GUIDE = `
# Guia InSeg MCP — o que voce pode fazer

Voce tem acesso **somente leitura** aos dados da consultoria InSeg no ProntEPI.
Sempre confirme **qual empresa (cliente)** antes de detalhar trabalhadores.

## Fluxo recomendado
1. \`consultoria_contexto\` — visao geral e cota de vidas
2. \`listar_empresas\` — todas as empresas gerenciadas
3. \`buscar_empresa_ou_trabalhador\` — achar por nome/CNPJ
4. \`resumo_empresa\` — indicadores de implantacao
5. Ferramentas especificas (trabalhadores, estrutura, treinamentos, SST, EPI)

## Ferramentas disponiveis
| Tool | Uso |
|------|-----|
| consultoria_contexto | Nome da consultoria, cota contratada/usada/disponivel |
| listar_empresas | Lista CNPJs ativos e inativos |
| buscar_empresa_ou_trabalhador | Busca por nome, CNPJ ou trabalhador |
| detalhe_empresa | Dados cadastrais de uma empresa |
| resumo_empresa | Overview: unidades, PGR, estoque, ultimo PGRO |
| listar_trabalhadores | Trabalhadores de uma empresa (CPF mascarado) |
| estrutura_empresa | Setores, funcoes, unidades |
| listar_grupos_empresariais | Grupos de CNPJs |
| catalogo_epi | Itens EPI da consultoria |
| necessidades_epi | Necessidades EPI vinculaveis |
| consultar_caepi | Validade/fabricante por numero CA |
| treinamentos_emitidos | Turmas/certificados gerados |
| documentos_sst | Integracao e O.S. (status, sem biometria) |
| estoque_consultoria | Resumo almoxarifado central |
| estoque_empresa | Resumo estoque de um cliente |
| guia_mcp | Este guia |

## Limites e privacidade
- CPF sempre mascarado (384.***.***-20)
- **Nunca** solicite biometria, fotos faciais ou tokens de assinatura
- Dados operacionais de entregas detalhadas podem estar no portal do cliente
- Responda em portugues, de forma objetiva para consultores SST
`.trim();

export function createMcpServer() {
  const server = new McpServer({
    name: 'inseg-gestao-epi',
    version: '1.0.0',
  });

  server.tool(
    'guia_mcp',
    'Retorna o guia completo do que o assistente pode fazer com os dados InSeg no ProntEPI.',
    {},
    async () => ({
      content: [{ type: 'text', text: GUIDE }],
    }),
  );

  server.tool(
    'consultoria_contexto',
    'Contexto da consultoria InSeg: nome, slug, cota de vidas contratada, alocada, usada e disponivel.',
    {},
    async () => json(await apiGet('/mcp/v1/context')),
  );

  server.tool(
    'listar_empresas',
    'Lista todas as empresas (clientes CNPJ) gerenciadas pela consultoria.',
    {},
    async () => json(await apiGet('/mcp/v1/clients')),
  );

  server.tool(
    'buscar_empresa_ou_trabalhador',
    'Busca empresas por razao social/CNPJ ou trabalhadores por nome em toda a carteira.',
    {
      consulta: z.string().min(2).describe('Nome, CNPJ parcial ou nome do trabalhador'),
      limite: z.number().int().min(1).max(50).optional(),
    },
    async ({ consulta, limite }) =>
      json(
        await apiGet('/mcp/v1/search', {
          q: consulta,
          limit: limite != null ? String(limite) : undefined,
        }),
      ),
  );

  server.tool(
    'detalhe_empresa',
    'Dados cadastrais de uma empresa pelo ID retornado em listar_empresas ou busca.',
    { empresaId: z.string().min(1) },
    async ({ empresaId }) => json(await apiGet(`/mcp/v1/clients/${empresaId}`)),
  );

  server.tool(
    'resumo_empresa',
    'Indicadores de implantacao: unidades, trabalhadores, PGR, estoque, ultimo import PGRO, usuarios portal.',
    { empresaId: z.string().min(1) },
    async ({ empresaId }) =>
      json(await apiGet(`/mcp/v1/clients/${empresaId}/overview`)),
  );

  server.tool(
    'listar_trabalhadores',
    'Trabalhadores de uma empresa. CPF mascarado; indica se tem cadastro facial (sem expor biometria).',
    {
      empresaId: z.string().min(1),
      status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      limite: z.number().int().min(1).max(500).optional(),
    },
    async ({ empresaId, status, limite }) =>
      json(
        await apiGet(`/mcp/v1/clients/${empresaId}/workers`, {
          status,
          limit: limite != null ? String(limite) : undefined,
        }),
      ),
  );

  server.tool(
    'estrutura_empresa',
    'Unidades operacionais, setores e funcoes (cargos) ativos de uma empresa.',
    { empresaId: z.string().min(1) },
    async ({ empresaId }) =>
      json(await apiGet(`/mcp/v1/clients/${empresaId}/structure`)),
  );

  server.tool(
    'listar_grupos_empresariais',
    'Grupos empresariais e CNPJs membros.',
    {},
    async () => json(await apiGet('/mcp/v1/groups')),
  );

  server.tool(
    'catalogo_epi',
    'Catalogo mestre de EPIs da consultoria (itens e variantes/CA).',
    {},
    async () => json(await apiGet('/mcp/v1/epi/catalog')),
  );

  server.tool(
    'necessidades_epi',
    'Necessidades EPI cadastradas (exclui itens junk/nao entregaveis).',
    {},
    async () => json(await apiGet('/mcp/v1/epi/needs')),
  );

  server.tool(
    'consultar_caepi',
    'Consulta certificado CAEPI oficial por numero de CA.',
    { numeroCa: z.string().min(1) },
    async ({ numeroCa }) => json(await apiGet(`/mcp/v1/caepi/${numeroCa}`)),
  );

  server.tool(
    'treinamentos_emitidos',
    'Turmas de treinamento/certificados emitidos. Opcional filtrar por empresa.',
    {
      empresaId: z.string().optional(),
      limite: z.number().int().min(1).max(100).optional(),
    },
    async ({ empresaId, limite }) =>
      json(
        await apiGet('/mcp/v1/training/issuances', {
          clientId: empresaId,
          limit: limite != null ? String(limite) : undefined,
        }),
      ),
  );

  server.tool(
    'documentos_sst',
    'Documentos SST (integracao, ordem de servico): status e trabalhador, sem evidencias biometricas.',
    {
      empresaId: z.string().optional(),
      status: z
        .enum(['PENDING_SIGNATURE', 'SIGNED', 'CANCELLED'])
        .optional(),
      limite: z.number().int().min(1).max(100).optional(),
    },
    async ({ empresaId, status, limite }) =>
      json(
        await apiGet('/mcp/v1/sst/documents', {
          clientId: empresaId,
          status,
          limit: limite != null ? String(limite) : undefined,
        }),
      ),
  );

  server.tool(
    'estoque_consultoria',
    'Resumo do estoque central da consultoria (almoxarifado proprio).',
    {},
    async () => json(await apiGet('/mcp/v1/stock/summary')),
  );

  server.tool(
    'estoque_empresa',
    'Resumo de estoque vinculado a uma empresa cliente.',
    { empresaId: z.string().min(1) },
    async ({ empresaId }) =>
      json(await apiGet(`/mcp/v1/clients/${empresaId}/stock-summary`)),
  );

  return server;
}

function json(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}
