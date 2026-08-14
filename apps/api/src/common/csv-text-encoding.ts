/**
 * Decodifica e limpa CSV vindo do Excel/Windows (Latin-1 / Windows-1252)
 * sem exigir que o cliente "conserte" a planilha.
 */

const REPLACEMENT = '\uFFFD';

function countChars(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

function portugueseScore(text: string): number {
  // Prefer textos com acentos PT-BR e sem lixo de encoding.
  const good = countChars(
    text,
    /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g,
  );
  const bad =
    countChars(text, new RegExp(REPLACEMENT, 'g')) * 8 +
    countChars(text, /Ã.|Â.|�/g) * 3 +
    countChars(text, /[\u0080-\u009f]/g) * 2;
  return good * 4 - bad;
}

/** Tenta reverter mojibake tipico: UTF-8 lido como Latin-1 (Ã§, Ã£...). */
export function fixUtf8Mojibake(text: string): string {
  if (!/[ÃÂ]/.test(text)) return text;
  try {
    const bytes = Buffer.from(
      Array.from(text, (ch) => ch.charCodeAt(0) & 0xff),
    );
    const decoded = bytes.toString('utf8');
    if (decoded.includes(REPLACEMENT)) return text;
    if (portugueseScore(decoded) > portugueseScore(text)) {
      return decoded;
    }
  } catch {
    // mantem original
  }
  return text;
}

/**
 * Remove dead keys (^ ~ ´ ` ¨) e acentos combinantes sem letra-base.
 * Mantem acentos legitimos (José, Produção).
 */
export function stripOrphanDiacritics(text: string): string {
  const nfd = text.normalize('NFD');
  let out = '';
  for (let i = 0; i < nfd.length; i += 1) {
    const ch = nfd[i]!;
    const code = ch.charCodeAt(0);
    const isCombining = code >= 0x0300 && code <= 0x036f;
    if (isCombining) {
      const prev = out.at(-1);
      if (prev && /[A-Za-z]/.test(prev)) {
        out += ch;
      }
      continue;
    }
    if (ch === '^' || ch === '~' || ch === '´' || ch === '`' || ch === '¨') {
      continue;
    }
    out += ch;
  }
  return out.normalize('NFC');
}

export function sanitizeCsvCellText(text: string): string {
  return stripOrphanDiacritics(fixUtf8Mojibake(text))
    .normalize('NFC')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function decodeCsvBytes(buffer: Buffer): string {
  if (!buffer.length) return '';

  const asUtf8 = buffer.toString('utf8');
  const utf8Bad = asUtf8.includes(REPLACEMENT);

  let asWin1252 = asUtf8;
  try {
    asWin1252 = new TextDecoder('windows-1252').decode(buffer);
  } catch {
    asWin1252 = buffer.toString('latin1');
  }

  let chosen = asUtf8;
  if (utf8Bad) {
    chosen = asWin1252;
  } else if (portugueseScore(asWin1252) > portugueseScore(asUtf8) + 2) {
    // Planilha Excel BR em ANSI sem byte invalido UTF-8 (raro), mas com mais acentos corretos.
    chosen = asWin1252;
  }

  chosen = fixUtf8Mojibake(chosen);
  return normalizeCsvImportText(chosen, { skipMojibake: true });
}

export function normalizeCsvImportText(
  text: string,
  options?: { skipMojibake?: boolean },
): string {
  let value = text.replace(/^\uFEFF/, '');
  if (!options?.skipMojibake) {
    value = fixUtf8Mojibake(value);
  }
  value = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  return value
    .split('\n')
    .map((line) => {
      // Nao colapsa delimitadores; so limpa celulas depois no parse.
      // Aqui so tira dead keys / lixo por linha inteira com cuidado.
      return stripOrphanDiacritics(line).normalize('NFC');
    })
    .join('\n');
}

export function resolveCsvImportInput(input: {
  csvText?: string | null;
  csvBase64?: string | null;
}): string {
  const base64 = input.csvBase64?.trim();
  if (base64) {
    const cleaned = base64.replace(/^data:.*,/, '').replace(/\s+/g, '');
    const buffer = Buffer.from(cleaned, 'base64');
    if (!buffer.length) {
      throw new Error('CSV em base64 vazio.');
    }
    return decodeCsvBytes(buffer);
  }
  const text = input.csvText ?? '';
  if (!text.trim()) {
    throw new Error('Envie o conteudo CSV para a previa.');
  }
  return normalizeCsvImportText(text);
}
