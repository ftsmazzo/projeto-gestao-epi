const base = (process.env.GESTAO_EPI_API_URL ?? 'http://127.0.0.1:3001').replace(
  /\/$/,
  '',
);
const apiKey = process.env.MCP_API_KEY?.trim() ?? '';

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string, query?: Record<string, string | undefined>) {
  const url = new URL(`${base}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== '') url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url, { headers: headers() });
  return parseJson<T>(res);
}

export function assertConfigured() {
  if (!apiKey) throw new Error('MCP_API_KEY nao configurada.');
}
