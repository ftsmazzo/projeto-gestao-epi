/**
 * Prints das telas públicas (sem login).
 * node docs/manuais/scripts/capture-public-screens.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = (
  process.env.PORTAL_BASE_URL ??
  'https://gestao-epi-web.kxryyk.easypanel.host'
).replace(/\/$/, '');

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const outDir = join(repoRoot, 'apps', 'web', 'public', 'branding', 'screens');

const shots = [
  ['home', '/'],
  ['login-consultoria', '/login'],
  ['login-portal', '/portal/login'],
  ['produto', '/produto'],
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.25,
});

try {
  await mkdir(outDir, { recursive: true });
  for (const [name, path] of shots) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: join(outDir, `${name}.png`),
      fullPage: true,
    });
    console.log('ok', name, page.url());
  }
} finally {
  await browser.close();
}
