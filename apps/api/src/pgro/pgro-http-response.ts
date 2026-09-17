export class PgroResponseTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Resposta excedeu o limite de ${maxBytes} bytes.`);
    this.name = 'PgroResponseTooLargeError';
  }
}

export async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new PgroResponseTooLargeError(maxBytes);
  }

  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new PgroResponseTooLargeError(maxBytes);
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new PgroResponseTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return merged.toString('utf8');
}
