/**
 * Captura prints do Painel do Cliente em producao.
 * Uso (PowerShell):
 *   $env:PORTAL_EMAIL="..."; $env:PORTAL_PASSWORD="..."
 *   node docs/manuais/scripts/capture-portal-screens.mjs
 *
 * Nao commitar senha. As imagens vao para docs/manuais/screenshots/.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const email = process.env.PORTAL_EMAIL;
const password = process.env.PORTAL_PASSWORD;
const baseUrl = (
  process.env.PORTAL_BASE_URL ??
  'https://gestao-epi-web.kxryyk.easypanel.host'
).replace(/\/$/, '');

if (!email || !password) {
  console.error('Defina PORTAL_EMAIL e PORTAL_PASSWORD no ambiente.');
  process.exit(1);
}

const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'screenshots',
);

async function shot(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({
    path: join(outDir, `${name}.png`),
    fullPage: true,
  });
  console.log(`ok ${name}.png`);
}

async function dismissIfAny(page) {
  const close = page.getByRole('button', { name: /fechar|ok|entendi/i });
  if (await close.first().isVisible().catch(() => false)) {
    await close.first().click().catch(() => {});
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.25,
});

try {
  await mkdir(outDir, { recursive: true });

  await page.goto(`${baseUrl}/portal/login`, { waitUntil: 'networkidle' });
  await dismissIfAny(page);
  await shot(page, '01-login');

  await page.locator('#portal-email').fill(email);
  await page.locator('#portal-password').fill(password);
  await Promise.all([
    page.waitForURL(
      (url) => {
        const path = new URL(url).pathname;
        return path === '/portal' || (path.startsWith('/portal/') && path !== '/portal/login');
      },
      { timeout: 25000 },
    ),
    page.getByRole('button', { name: /Entrar no painel/i }).click(),
  ]);
  await page.waitForTimeout(1500);
  console.log('logged in at', page.url());
  await page.getByText(/Bragametal|Tadeu|vidas/i).first().waitFor({ timeout: 15000 });

  if (page.url().includes('/portal/conta')) {
    await shot(page, '02-conta-troca-senha');
    console.warn('Conta exige troca de senha — demais telas podem estar bloqueadas.');
  }

  const routes = [
    ['02-painel', '/portal'],
    ['03-entregas', '/portal/entregas'],
    ['04-estoque', '/portal/estoque'],
    ['05-validade', '/portal/validade'],
    ['06-trabalhadores', '/portal/trabalhadores'],
    ['07-relatorios', '/portal/relatorios'],
    ['08-estrutura', '/portal/estrutura'],
    ['09-custos', '/portal/custos'],
    ['10-conta', '/portal/conta'],
    ['11-ficha-epi', '/portal/trabalhadores/cms4ph1ln00ktlb01ybi02sgn/ficha-epi'],
    ['12-comprovante', '/portal/entregas/6ce41f88df3945b7b2c7545f'],
  ];

  for (const [name, path] of routes) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await shot(page, name);
  }

  await page.goto(`${baseUrl}/portal/trabalhadores`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const importBtn = page.getByRole('button', { name: /Importar CSV/i }).first();
  if (await importBtn.isVisible().catch(() => false)) {
    await importBtn.click();
    await page.waitForTimeout(800);
    await shot(page, '13-importar-csv');
  }

  await page.goto(`${baseUrl}/portal/estoque`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const saldos = page.getByRole('button', { name: /Saldos/i }).first();
  if (await saldos.isVisible().catch(() => false)) {
    await saldos.click();
    await page.waitForTimeout(700);
    await shot(page, '14-estoque-saldos');
  }

  await page.goto(`${baseUrl}/portal/relatorios`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const trocasTab = page.getByRole('button', { name: /^Trocas/i }).first();
  if (await trocasTab.isVisible().catch(() => false)) {
    await trocasTab.click();
    await page.waitForTimeout(900);
    await shot(page, '15-relatorios-trocas');
  }

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await mobile.goto(`${baseUrl}/portal/login`, { waitUntil: 'networkidle' });
  await mobile.locator('#portal-email').fill(email);
  await mobile.locator('#portal-password').fill(password);
  await Promise.all([
    mobile.waitForURL(
      (url) => {
        const path = new URL(url).pathname;
        return path === '/portal' || (path.startsWith('/portal/') && path !== '/portal/login');
      },
      { timeout: 25000 },
    ),
    mobile.getByRole('button', { name: /Entrar no painel/i }).click(),
  ]);
  await mobile.waitForTimeout(1200);
  await mobile.screenshot({
    path: join(outDir, '16-painel-mobile.png'),
    fullPage: true,
  });
  console.log('ok 16-painel-mobile.png');
  await mobile.goto(`${baseUrl}/portal/entregas`, { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(900);
  await mobile.screenshot({
    path: join(outDir, '17-entregas-mobile.png'),
    fullPage: true,
  });
  console.log('ok 17-entregas-mobile.png');
  await mobile.close();
} finally {
  await browser.close();
}
