import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const SALT = 'distributor-a1';

export class FiscalCertificateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FiscalCertificateError';
  }
}

export type SealedCertificate = {
  cipher: Buffer;
  iv: Buffer;
  tag: Buffer;
};

function secretKey(): Buffer {
  const secret = process.env.FISCAL_CERT_SECRET?.trim() ?? '';
  if (secret.length < 16) {
    throw new FiscalCertificateError(
      'O servidor ainda nao tem FISCAL_CERT_SECRET para guardar o certificado.',
    );
  }
  return scryptSync(secret, SALT, 32);
}

export function sealCertificate(pfx: Buffer, password: string): SealedCertificate {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv);
  const payload = Buffer.from(JSON.stringify({ pfx: pfx.toString('base64'), password }), 'utf8');
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return { cipher: encrypted, iv, tag: cipher.getAuthTag() };
}

export function openCertificate(sealed: SealedCertificate): { pfx: Buffer; password: string } {
  const decipher = createDecipheriv('aes-256-gcm', secretKey(), sealed.iv);
  decipher.setAuthTag(sealed.tag);
  const json = Buffer.concat([decipher.update(sealed.cipher), decipher.final()]).toString('utf8');
  const parsed = JSON.parse(json) as { pfx?: string; password?: string };
  if (!parsed.pfx || !parsed.password) {
    throw new FiscalCertificateError('O certificado guardado esta incompleto.');
  }
  return { pfx: Buffer.from(parsed.pfx, 'base64'), password: parsed.password };
}
