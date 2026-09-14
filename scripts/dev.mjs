/**
 * Server zhvillimi pa varesi: rindërton HTML-in kur ndryshon src/,
 * mban Tailwind ne watch, dhe sherben dist/ me clean URLs (si Vercel/Netlify).
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const PORT = Number(process.env.PORT) || 3000;
const OUT = 'dist';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const TW = join('node_modules', '.bin', 'tailwindcss');
const CSS_ARGS = ['-i', './src/styles/main.css', '-o', './dist/assets/css/main.css'];

const run = (cmd, args, env) => new Promise((resolve) => {
  spawn(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  }).on('close', resolve);
});

let building = false;
let queued = false;

async function rebuild() {
  if (building) { queued = true; return; }
  building = true;
  await run(process.execPath, ['build.mjs'], { NO_CLEAN: '1' });
  building = false;
  if (queued) { queued = false; await rebuild(); }
}

/** Provon: skedar ekzakt -> <path>/index.html -> <path>.html */
async function resolveFile(urlPath) {
  const safe = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const base = join(OUT, safe);
  for (const candidate of [base, join(base, 'index.html'), `${base}.html`]) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch { /* provo kandidatin tjeter */ }
  }
  return null;
}

await rebuild();
await run(TW, CSS_ARGS); // nje here para watch-it, qe CSS-ja te jete gati menjehere

// Tailwind ne watch — shkruan direkt ne dist/, pa e bllokuar procesin
spawn(TW, [...CSS_ARGS, '--watch'], {
  stdio: ['ignore', 'ignore', 'inherit'],
  shell: process.platform === 'win32',
});

let timer;
watch('src', { recursive: true }, (_event, file) => {
  if (file && file.startsWith('styles')) return; // Tailwind e mbulon vete
  clearTimeout(timer);
  timer = setTimeout(rebuild, 120);
});

createServer(async (req, res) => {
  const file = await resolveFile(req.url || '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404</h1>');
    return;
  }
  const body = await readFile(file);
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}).listen(PORT, () => {
  console.log(`\n  http://localhost:${PORT}\n  duke pritur ndryshime ne src/ ...\n`);
});
