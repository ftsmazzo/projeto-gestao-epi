/**
 * Grava o reel comercial ProntEPI (1080x1920) a partir do HTML animado.
 * Uso: node record-prontepi-reel.mjs
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../scripts/package.json'));
const { chromium } = require('playwright');
const htmlPath = path.join(__dirname, 'prontepi-reel.html');
const outDir = path.join(__dirname, 'out');
const framesDir = path.join(outDir, 'frames');
const mp4Path = path.join(outDir, 'prontepi-reel-instagram.mp4');
const durationMs = 24500;
const fps = 30;

function findFfmpeg() {
  const which = spawnSync('where.exe', ['ffmpeg'], { encoding: 'utf8' });
  if (which.status === 0) {
    const line = which.stdout.split(/\r?\n/).find(Boolean);
    if (line) return line.trim();
  }
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages'),
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
  ];
  for (const root of candidates) {
    if (!fs.existsSync(root)) continue;
    const walk = (dir, depth = 0) => {
      if (depth > 4) return null;
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        let st;
        try { st = fs.statSync(full); } catch { continue; }
        if (st.isDirectory()) {
          const found = walk(full, depth + 1);
          if (found) return found;
        } else if (name.toLowerCase() === 'ffmpeg.exe') {
          return full;
        }
      }
      return null;
    };
    const hit = walk(root);
    if (hit) return hit;
  }
  return 'ffmpeg';
}

async function main() {
  fs.mkdirSync(framesDir, { recursive: true });
  for (const f of fs.readdirSync(framesDir)) {
    fs.unlinkSync(path.join(framesDir, f));
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });

  const url = pathToFileURL(htmlPath).href;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const totalFrames = Math.round((durationMs / 1000) * fps);
  console.log(`Capturando ${totalFrames} frames @ ${fps}fps...`);

  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    await page.evaluate((seconds) => {
      document.getAnimations().forEach((a) => {
        try { a.currentTime = seconds * 1000; } catch {}
      });
    }, t);
    const file = path.join(framesDir, `frame-${String(i).padStart(5, '0')}.png`);
    await page.screenshot({ path: file, type: 'png' });
    if (i % 30 === 0) console.log(`  frame ${i}/${totalFrames}`);
  }

  await browser.close();

  const ffmpeg = findFfmpeg();
  console.log(`Codificando com ${ffmpeg}...`);
  const args = [
    '-y',
    '-framerate', String(fps),
    '-i', path.join(framesDir, 'frame-%05d.png'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'high',
    '-level', '4.1',
    '-crf', '18',
    '-movflags', '+faststart',
    '-vf', 'scale=1080:1920:flags=lanczos',
    mp4Path,
  ];
  const res = spawnSync(ffmpeg, args, { stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`ffmpeg falhou com codigo ${res.status}`);
  }

  console.log(`Pronto: ${mp4Path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
