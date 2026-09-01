import { randomUUID } from 'node:crypto';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { assertConfigured } from './api-client.js';
import {
  isOAuthAccessToken,
  mountOAuthRoutes,
  oauthUnauthorizedHeader,
} from './oauth.js';
import { createMcpServer } from './server.js';

const port = Number(process.env.MCP_PORT ?? process.env.PORT ?? 3100);
const publicKey = process.env.MCP_PUBLIC_KEY?.trim() ?? process.env.MCP_API_KEY?.trim() ?? '';

function extractToken(req: express.Request): string {
  const authHeader = req.headers.authorization?.trim() ?? '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const apiKeyHeaders = [
    'x-api-key',
    'x-auth-token',
    'x-api-token',
    'api-key',
    'apikey',
    'x-apikey',
  ] as const;
  for (const name of apiKeyHeaders) {
    const value = req.headers[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function authOk(req: express.Request) {
  if (!publicKey) return false;
  const token = extractToken(req);
  if (!token) return false;
  if (token === publicKey) return true;
  return isOAuthAccessToken(token);
}

const publicBaseUrl =
  process.env.MCP_PUBLIC_URL?.trim() ||
  'https://gestao-epi-mcp-inseg.kxryyk.easypanel.host';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const { metadataUrl, scope } = mountOAuthRoutes(app, publicBaseUrl, publicKey);

function unauthorized(res: express.Response) {
  res
    .status(401)
    .set('WWW-Authenticate', oauthUnauthorizedHeader(metadataUrl, scope))
    .json({
      error: 'Unauthorized',
      hint:
        'Conecte via OAuth no Claude Teams (registro automatico) ou envie x-api-key / Bearer com a chave InSeg.',
    });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'inseg-gestao-epi-mcp', oauth: true });
});

app.get('/mcp', (_req, res) => {
  res.json({
    name: 'inseg-gestao-epi',
    transport: 'streamable-http',
    oauth: {
      protectedResourceMetadata: metadataUrl,
      authorizationServer: publicBaseUrl.replace(/\/$/, ''),
    },
    endpoint: `${publicBaseUrl.replace(/\/$/, '')}/mcp`,
  });
});

app.get('/', (_req, res) => {
  res.type('text/plain').send(
    [
      'InSeg MCP — ProntEPI Gestao EPI',
      '',
      'Endpoint MCP (Streamable HTTP): POST /mcp',
      'Autenticacao:',
      '  1) OAuth 2.1 (Claude Teams): registro automatico + login com chave InSeg',
      '  2) x-api-key ou Authorization Bearer (integracoes diretas)',
      '',
      `OAuth metadata: ${metadataUrl}`,
      '',
      `Tools: ${[
        'guia_mcp',
        'consultoria_contexto',
        'listar_empresas',
        'buscar_empresa_ou_trabalhador',
        'detalhe_empresa',
        'resumo_empresa',
        'listar_trabalhadores',
        'estrutura_empresa',
        'listar_grupos_empresariais',
        'catalogo_epi',
        'necessidades_epi',
        'consultar_caepi',
        'treinamentos_emitidos',
        'documentos_sst',
        'estoque_consultoria',
        'estoque_empresa',
      ].join(', ')}`,
    ].join('\n'),
  );
});

app.post('/mcp', async (req, res) => {
  if (!authOk(req)) {
    unauthorized(res);
    return;
  }

  try {
    assertConfigured();
    const mcpServer = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`InSeg MCP listening on :${port} (OAuth enabled)`);
});
