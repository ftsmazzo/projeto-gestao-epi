import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';

const SCOPE = 'mcp:read';
const TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 dias

type RegisteredClient = {
  clientId: string;
  clientSecret?: string;
  redirectUris: string[];
  clientName?: string;
  tokenEndpointAuthMethod: string;
};

type PendingCode = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource?: string;
  accessKey: string;
  expiresAt: number;
};

type IssuedToken = {
  accessKey: string;
  resource?: string;
  expiresAt: number;
};

const registeredClients = new Map<string, RegisteredClient>();
const pendingCodes = new Map<string, PendingCode>();
const issuedTokens = new Map<string, IssuedToken>();

function b64url(buf: Buffer) {
  return buf.toString('base64url');
}

function pkceS256(verifier: string) {
  return b64url(createHash('sha256').update(verifier).digest());
}

function resourceUri(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, '')}/mcp`;
}

function issuerUri(baseUrl: string) {
  return baseUrl.replace(/\/$/, '');
}

function protectedResourceMetadataUrl(baseUrl: string) {
  return `${issuerUri(baseUrl)}/.well-known/oauth-protected-resource`;
}

function asMetadata(baseUrl: string) {
  const issuer = issuerUri(baseUrl);
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: [SCOPE],
    client_id_metadata_document_supported: true,
  };
}

function protectedResourceMetadata(baseUrl: string) {
  const issuer = issuerUri(baseUrl);
  return {
    resource: resourceUri(baseUrl),
    authorization_servers: [issuer],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'InSeg ProntEPI MCP',
  };
}

function parseBodyField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : '';
}

async function resolveClientRedirectUris(clientId: string): Promise<string[] | null> {
  const local = registeredClients.get(clientId);
  if (local) return local.redirectUris;

  if (!clientId.startsWith('https://')) return null;

  try {
    const res = await fetch(clientId, { redirect: 'follow' });
    if (!res.ok) return null;
    const doc = (await res.json()) as { client_id?: string; redirect_uris?: string[] };
    if (doc.client_id !== clientId) return null;
    if (!Array.isArray(doc.redirect_uris) || doc.redirect_uris.length === 0) return null;
    return doc.redirect_uris.map((u) => String(u));
  } catch {
    return null;
  }
}

function authorizeHtml(params: {
  clientId: string;
  redirectUri: string;
  state?: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource?: string;
  scope?: string;
  error?: string;
}) {
  const hidden = [
    ['client_id', params.clientId],
    ['redirect_uri', params.redirectUri],
    ['code_challenge', params.codeChallenge],
    ['code_challenge_method', params.codeChallengeMethod],
    ['response_type', 'code'],
    ...(params.state ? [['state', params.state] as const] : []),
    ...(params.resource ? [['resource', params.resource] as const] : []),
    ...(params.scope ? [['scope', params.scope] as const] : []),
  ]
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${name}" value="${String(value).replace(/"/g, '&quot;')}" />`,
    )
    .join('\n');

  const error = params.error
    ? `<p style="color:#b42318;background:#fef3f2;padding:.75rem;border-radius:8px">${params.error}</p>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Conectar Claude — InSeg ProntEPI</title>
  <style>
    body { font-family: system-ui, sans-serif; background:#f4f7fb; margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; }
    .card { background:#fff; padding:2rem; border-radius:12px; box-shadow:0 8px 30px rgba(16,24,40,.08); width:min(420px, calc(100vw - 2rem)); }
    h1 { font-size:1.25rem; margin:0 0 .5rem; color:#101828; }
    p { color:#475467; line-height:1.5; }
    label { display:block; font-weight:600; margin:1rem 0 .35rem; color:#344054; }
    input[type=password] { width:100%; box-sizing:border-box; padding:.75rem; border:1px solid #d0d5dd; border-radius:8px; font-size:1rem; }
    button { margin-top:1.25rem; width:100%; padding:.85rem; border:0; border-radius:8px; background:#027948; color:#fff; font-size:1rem; font-weight:600; cursor:pointer; }
    button:hover { background:#05603a; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Conectar Claude Teams</h1>
    <p>Autorize o acesso somente leitura aos dados da consultoria <strong>InSeg</strong> no ProntEPI.</p>
    ${error}
    <form method="post" action="/oauth/authorize">
      ${hidden}
      <label for="access_key">Chave de acesso InSeg</label>
      <input id="access_key" name="access_key" type="password" autocomplete="off" required placeholder="Cole a chave fornecida pela InSeg" />
      <button type="submit">Autorizar conexão</button>
    </form>
  </div>
</body>
</html>`;
}

export function isOAuthAccessToken(token: string): boolean {
  const row = issuedTokens.get(token);
  return Boolean(row && row.expiresAt > Date.now());
}

export function mountOAuthRoutes(app: Express, baseUrl: string, apiKey: string) {
  const metadataUrl = protectedResourceMetadataUrl(baseUrl);

  app.get('/.well-known/oauth-protected-resource', (_req, res) => {
    res.json(protectedResourceMetadata(baseUrl));
  });

  app.get('/.well-known/oauth-protected-resource/mcp', (_req, res) => {
    res.json(protectedResourceMetadata(baseUrl));
  });

  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    res.json(asMetadata(baseUrl));
  });

  app.get('/.well-known/openid-configuration', (_req, res) => {
    res.json({ ...asMetadata(baseUrl), subject_types_supported: ['public'] });
  });

  // Fallback legado (alguns clientes antigos)
  app.post('/register', (req, res) => {
    handleRegister(req, res);
  });

  app.post('/oauth/register', (req, res) => {
    handleRegister(req, res);
  });

  function handleRegister(req: Request, res: Response) {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const redirectUrisRaw = body.redirect_uris;
    const redirectUris = Array.isArray(redirectUrisRaw)
      ? redirectUrisRaw.map((u) => String(u))
      : [];
    if (redirectUris.length === 0) {
      res.status(400).json({ error: 'invalid_client_metadata', error_description: 'redirect_uris obrigatorio' });
      return;
    }

    const clientId = randomUUID();
    const clientSecret = randomBytes(24).toString('hex');
    const tokenEndpointAuthMethod =
      parseBodyField(body, 'token_endpoint_auth_method') || 'client_secret_post';

    registeredClients.set(clientId, {
      clientId,
      clientSecret: tokenEndpointAuthMethod === 'none' ? undefined : clientSecret,
      redirectUris,
      clientName: parseBodyField(body, 'client_name') || 'MCP Client',
      tokenEndpointAuthMethod,
    });

    res.status(201).json({
      client_id: clientId,
      client_secret: tokenEndpointAuthMethod === 'none' ? undefined : clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: tokenEndpointAuthMethod,
      grant_types: ['authorization_code'],
      response_types: ['code'],
      client_name: parseBodyField(body, 'client_name') || 'MCP Client',
    });
  }

  app.get('/oauth/authorize', async (req, res) => {
    const clientId = String(req.query.client_id ?? '').trim();
    const redirectUri = String(req.query.redirect_uri ?? '').trim();
    const codeChallenge = String(req.query.code_challenge ?? '').trim();
    const codeChallengeMethod = String(req.query.code_challenge_method ?? 'S256').trim();
    const state = String(req.query.state ?? '').trim();
    const resource = String(req.query.resource ?? '').trim();
    const scope = String(req.query.scope ?? SCOPE).trim();

    if (!clientId || !redirectUri || !codeChallenge) {
      res.status(400).send('Parametros OAuth incompletos.');
      return;
    }
    if (codeChallengeMethod !== 'S256') {
      res.status(400).send('Suporte apenas a PKCE S256.');
      return;
    }

    const allowedRedirects = await resolveClientRedirectUris(clientId);
    if (!allowedRedirects?.includes(redirectUri)) {
      res.status(400).send('redirect_uri invalido para este client_id.');
      return;
    }

    res.type('html').send(
      authorizeHtml({
        clientId,
        redirectUri,
        state: state || undefined,
        codeChallenge,
        codeChallengeMethod,
        resource: resource || undefined,
        scope,
      }),
    );
  });

  app.post('/oauth/authorize', async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const clientId = parseBodyField(body, 'client_id');
    const redirectUri = parseBodyField(body, 'redirect_uri');
    const codeChallenge = parseBodyField(body, 'code_challenge');
    const codeChallengeMethod = parseBodyField(body, 'code_challenge_method') || 'S256';
    const state = parseBodyField(body, 'state');
    const resource = parseBodyField(body, 'resource');
    const accessKey = parseBodyField(body, 'access_key');

    if (!clientId || !redirectUri || !codeChallenge) {
      res.status(400).send('Parametros OAuth incompletos.');
      return;
    }

    const allowedRedirects = await resolveClientRedirectUris(clientId);
    if (!allowedRedirects?.includes(redirectUri)) {
      res.status(400).send('redirect_uri invalido.');
      return;
    }

    if (!apiKey || accessKey !== apiKey) {
      res.type('html').status(401).send(
        authorizeHtml({
          clientId,
          redirectUri,
          state: state || undefined,
          codeChallenge,
          codeChallengeMethod,
          resource: resource || undefined,
          error: 'Chave invalida. Confira a chave de acesso InSeg e tente novamente.',
        }),
      );
      return;
    }

    const code = randomBytes(24).toString('hex');
    pendingCodes.set(code, {
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      resource: resource || resourceUri(baseUrl),
      accessKey,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const url = new URL(redirectUri);
    url.searchParams.set('code', code);
    if (state) url.searchParams.set('state', state);
    res.redirect(302, url.toString());
  });

  app.post('/oauth/token', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const grantType = parseBodyField(body, 'grant_type');
    if (grantType !== 'authorization_code') {
      res.status(400).json({ error: 'unsupported_grant_type' });
      return;
    }

    const code = parseBodyField(body, 'code');
    const redirectUri = parseBodyField(body, 'redirect_uri');
    const clientId = parseBodyField(body, 'client_id');
    const codeVerifier = parseBodyField(body, 'code_verifier');
    const resource = parseBodyField(body, 'resource');

    const pending = pendingCodes.get(code);
    if (!pending || pending.expiresAt < Date.now()) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    if (pending.clientId !== clientId || pending.redirectUri !== redirectUri) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    if (pkceS256(codeVerifier) !== pending.codeChallenge) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE invalido' });
      return;
    }

    if (resource && pending.resource && resource !== pending.resource) {
      res.status(400).json({ error: 'invalid_target' });
      return;
    }

    pendingCodes.delete(code);

    const accessToken = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + TOKEN_TTL_SEC * 1000;
    issuedTokens.set(accessToken, {
      accessKey: pending.accessKey,
      resource: pending.resource,
      expiresAt,
    });

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: TOKEN_TTL_SEC,
      scope: SCOPE,
    });
  });

  return { metadataUrl, scope: SCOPE };
}

export function oauthUnauthorizedHeader(metadataUrl: string, scope: string) {
  return `Bearer resource_metadata="${metadataUrl}", scope="${scope}"`;
}
