import { randomUUID } from 'node:crypto';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { assertConfigured } from './api-client.js';
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
  return token.length > 0 && token === publicKey;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'inseg-gestao-epi-mcp' });
});

app.get('/', (_req, res) => {
  res.type('text/plain').send(
    [
      'InSeg MCP — ProntEPI Gestao EPI',
      '',
      'Endpoint MCP (Streamable HTTP): POST /mcp',
      'Autenticacao (escolha uma):',
      '  Authorization: Bearer <MCP_PUBLIC_KEY>',
      '  x-api-key: <MCP_PUBLIC_KEY>  (recomendado no Claude Teams com OAuth)',
      'Guia: use a tool guia_mcp apos conectar no Claude Teams.',
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
    res.status(401).json({ error: 'Unauthorized' });
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
  console.log(`InSeg MCP listening on :${port}`);
});
