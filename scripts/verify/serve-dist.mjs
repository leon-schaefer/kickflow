/**
 * Serviert dist/ mit der Semantik aus vercel.json — Header, cleanUrls und
 * SPA-Rewrite werden AUS DER DATEI gelesen, damit die lokale Prüfung nicht von
 * Produktion abdriften kann.
 *
 * Der häufigste Fehler bei so einer Verifikation ist `serve -s dist`: das
 * sendet keine CSP, und genau die CSP ist der Ort, an dem Vite überrascht.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const ROOT = process.argv[2];
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.argv[3] ?? 4173);

const vercel = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const HEADERS = Object.fromEntries(
  vercel.headers.flatMap((block) => block.headers.map((h) => [h.key, h.value])),
);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function resolveFile(pathname) {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  const direct = path.join(DIST, rel);
  if (rel && existsSync(direct) && statSync(direct).isFile()) return direct;
  // cleanUrls: /foo -> /foo.html
  if (rel && existsSync(`${direct}.html`)) return `${direct}.html`;
  return null;
}

createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  // Der Catch-All-Rewrite aus vercel.json: /:path* -> / mit Status 200.
  // Genau darauf nehmen register-sw.js und buildId.ts Rücksicht.
  const file = resolveFile(pathname) ?? path.join(DIST, 'index.html');

  for (const [key, value] of Object.entries(HEADERS)) res.setHeader(key, value);
  res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
  res.writeHead(200);
  createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`dist/ auf http://localhost:${PORT} — CSP aus vercel.json`);
});
