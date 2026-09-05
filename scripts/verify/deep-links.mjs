/**
 * Deep-Link-Matrix gegen das GEBAUTE Artefakt, unter der echten CSP.
 *
 * Warum das nicht in Vitest gehört und nicht in CI läuft: geprüft wird hier
 * genau das, was jsdom NICHT kann — die Content-Security-Policy aus
 * vercel.json, der Service Worker, der SPA-Rewrite und die echten
 * Deep-Link-Einstiege. Playwright ist deshalb bewusst KEINE Dependency des
 * Projekts; das Skript erwartet eine vorhandene Installation.
 *
 *   npm run build:web
 *   node scripts/verify/serve-dist.mjs . 4173 &
 *   node scripts/verify/deep-links.mjs http://localhost:4173
 *
 * CSP-Verstöße werden über das DOM-Event `securitypolicyviolation` gesammelt,
 * nicht über eine Konsolen-Textsuche — das ist der zuverlässige Weg und der
 * einzige, der auch stille Verstöße sieht. Genau so ist der zod-JIT-Verstoß
 * aufgefallen, den die Konsole nur als abgefangenen Fehler zeigte (siehe
 * src/app/zodConfig.ts).
 */
import { createRequire } from 'node:module';

// Playwright ist absichtlich keine Projekt-Dependency (siehe oben) — hier also
// aus der globalen Installation, und mit einer klaren Meldung, wenn sie fehlt.
let chromium;
try {
  chromium = createRequire(import.meta.url)('playwright').chromium;
} catch {
  console.error(
    'playwright nicht gefunden. Global installieren (npm i -g playwright) oder\n' +
      'NODE_PATH auf eine Installation zeigen lassen.',
  );
  process.exit(2);
}

const BASE = process.argv[2] ?? 'http://localhost:4173';

/*
 * Erwartete h1 je URL. Die vier Liga-Tabs tragen dort den LeagueSwitcher —
 * ohne geladene Ligenliste ist das der Fallback 'Liga'. Der Mehr-Tab hat als
 * einziger einen festen Titel, der Login gar keinen AppHeader.
 */
const URLS = [
  ['/login', 'Kickflow'],
  ['/leagues', 'Meine Ligen'],
  ['/settings', 'Einstellungen'],
  ['/42/lineup', 'Liga'],
  ['/42/players', 'Liga'],
  ['/42/market', 'Liga'],
  ['/42/league', 'Liga'],
  ['/42/more', 'Mehr'],
  ['/42/player/99', 'Spieler'],
  ['/42/manager/7', 'Manager'],
  ['/42/rules', 'Regeln'],
  ['/42/fixtures', 'Restprogramm'],
];

const browser = await chromium.launch();
const results = [];
let failures = 0;

async function open(pathname, { session = true } = {}) {
  const context = await browser.newContext();
  await context.addInitScript(
    ([key, withSession]) => {
      if (withSession) {
        localStorage.setItem(key, JSON.stringify({ token: 'verify-token', refreshToken: null }));
      }
      window.__csp = [];
      window.__errors = [];
      window.addEventListener('securitypolicyviolation', (e) =>
        window.__csp.push(`${e.violatedDirective}: ${e.blockedURI}`),
      );
      window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
    },
    ['kickflow.session.v1', session],
  );

  const page = await context.newPage();
  const consoleErrors = [];
  // Fehlgeschlagene Kickbase-Requests sind hier ERWARTET: das Token ist
  // erfunden, und in einer abgeschotteten Umgebung gibt es zu api.kickbase.com
  // gar keine Route. Dass die App es überhaupt versucht, belegt sogar, dass
  // `connect-src` den Host durchlässt. Alles andere ist ein echter Fehler.
  const expected = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|Failed to fetch|api\.kickbase\.com/;
  page.on('console', (m) => {
    if (m.type() === 'error' && !expected.test(m.text())) consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => !expected.test(String(e)) && consoleErrors.push(String(e)));

  const response = await page.goto(BASE + pathname, { waitUntil: 'networkidle' });
  return { context, page, response, consoleErrors };
}

for (const [pathname, heading] of URLS) {
  const { context, page, response, consoleErrors } = await open(pathname);

  const status = response?.status();
  // Der LeagueSwitcher trägt ein dekoratives Chevron IM h1 — es ist
  // aria-hidden und gehört nicht zum Titel.
  const h1 = await page
    .locator('h1')
    .first()
    .textContent()
    .then((t) => t?.replace(/[▾›‹]/g, ''))
    .catch(() => null);
  const csp = await page.evaluate(() => window.__csp ?? []);
  const url = page.url().replace(BASE, '');

  const ok = status === 200 && h1?.trim() === heading && csp.length === 0 && consoleErrors.length === 0;
  if (!ok) failures++;
  results.push({
    pathname,
    status,
    url,
    h1: h1?.trim(),
    erwartet: heading,
    csp: csp.length,
    fehler: consoleErrors.length,
    ok,
  });
  if (!ok && consoleErrors.length) console.log(`  ${pathname} Konsole:`, consoleErrors.slice(0, 3));
  if (!ok && csp.length) console.log(`  ${pathname} CSP:`, csp.slice(0, 3));

  await context.close();
}

console.table(results);

// Sonderfälle
const extra = [];

{
  // Deep Link ohne Session muss auf /login umleiten.
  const { context, page } = await open('/42/lineup', { session: false });
  extra.push({ fall: 'Deep Link ohne Session', ergebnis: page.url().replace(BASE, ''), erwartet: '/login' });
  await context.close();
}
{
  // Nackte Liga-URL -> erster Tab. Vorher lief das ins Leere.
  const { context, page } = await open('/42');
  extra.push({ fall: 'nackte Liga-URL', ergebnis: page.url().replace(BASE, ''), erwartet: '/42/lineup' });
  await context.close();
}
{
  // Unbekannte Unterseite -> 404-Route.
  const { context, page } = await open('/42/gibt-es-nicht');
  const h1 = await page.locator('h1').first().textContent();
  extra.push({ fall: 'unbekannte Unterseite', ergebnis: h1?.trim(), erwartet: 'Nicht gefunden' });
  await context.close();
}
{
  // Zurück-Label per Deep Link, ohne location.state -> Fallback.
  const { context, page } = await open('/42/player/99');
  const back = await page.locator('header a').first().textContent();
  extra.push({ fall: 'Zurück-Label (Deep Link)', ergebnis: back?.replace(/\s+/g, ' ').trim(), erwartet: '‹Aufstellung' });
  await context.close();
}
{
  // Tab-Leiste: Aktivmarkierung und Anzahl.
  const { context, page } = await open('/42/market');
  const tabs = await page.locator('nav[aria-label="Liga-Bereiche"] a').count();
  const current = await page.locator('nav a[aria-current="page"]').textContent();
  extra.push({ fall: 'Tab-Leiste', ergebnis: `${tabs} Tabs, aktiv: ${current?.trim()}`, erwartet: '5 Tabs, aktiv: Markt' });
  await context.close();
}
{
  // Service Worker muss sich registrieren und /assets/ cache-first halten.
  const { context, page } = await open('/login');
  // Erst auf die Kontrolle warten, dann NEU laden: vorher laufen die Requests
  // nicht durch den Worker, der Cache bleibt also leer.
  await page.evaluate(async () => {
    let tries = 0;
    while (!navigator.serviceWorker.controller && tries++ < 60) {
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  const sw = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cached = await Promise.all(
      keys.map(async (k) => (await caches.open(k)).keys().then((r) => r.map((q) => new URL(q.url).pathname))),
    );
    const assets = cached.flat().filter((p) => p.startsWith('/assets/'));
    return `caches: ${keys.join(',')}; /assets/ gecacht: ${assets.length}`;
  });
  extra.push({ fall: 'Service Worker', ergebnis: sw, erwartet: 'kickflow-v2, /assets/ > 0' });
  await context.close();
}

console.table(extra);
await browser.close();

const PRUEFUNG = {
  'Deep Link ohne Session': (r) => r === '/login',
  'nackte Liga-URL': (r) => r === '/42/lineup',
  'unbekannte Unterseite': (r) => r === 'Nicht gefunden',
  'Zurück-Label (Deep Link)': (r) => r === '‹Aufstellung',
  'Tab-Leiste': (r) => r === '5 Tabs, aktiv: Markt',
  'Service Worker': (r) => r.includes('kickflow-v2') && !r.endsWith('gecacht: 0'),
};
const extraFails = extra.filter((e) => !PRUEFUNG[e.fall](String(e.ergebnis ?? '')));
console.log(`\nMatrix: ${URLS.length - failures}/${URLS.length} ok`);
if (failures || extraFails.length) {
  console.log('Abweichungen bei Sonderfällen:', extraFails.map((e) => e.fall).join(', ') || '—');
  process.exit(1);
}
console.log('Alle Prüfungen bestanden.');
