/**
 * Berechnete Stile gegen die Absicht der CSS-Module — im echten Browser.
 *
 * Warum das ein eigenes Skript braucht: jsdom rechnet keine Kaskade und keine
 * Spezifität, ein Unit-Test kann diese Klasse von Fehlern also nicht sehen.
 * Und sie ist real aufgetreten: Vite emittiert eine über `composes`
 * eingebundene Klasse NACH der einbindenden Regel, bei gleicher Spezifität
 * gewinnt damit die Basisklasse. `layout.pressable` (font/color/background/
 * padding auf inherit bzw. none) hat so jeden Button entstylt — ohne
 * Hintergrund, ohne Padding, in der falschen Schrift.
 *
 * Behoben durch `:where()` um die Basisklassen (Spezifität null). Dieses
 * Skript hält fest, dass es behoben BLEIBT.
 *
 *   npm run build:web
 *   node scripts/verify/serve-dist.mjs . 4173 &
 *   node scripts/verify/computed-styles.mjs http://localhost:4173
 */
import { createRequire } from 'node:module';

let chromium;
try {
  chromium = createRequire(import.meta.url)('playwright').chromium;
} catch {
  console.error('playwright nicht gefunden (global installieren oder NODE_PATH setzen).');
  process.exit(2);
}

const BASE = process.argv[2] ?? 'http://localhost:4173';

/**
 * [Pfad, Selektor, Beschreibung, { CSS-Eigenschaft: Sollwert }, Optionen?]
 *
 * Optionen: `session` legt eine Sitzung in den Speicher (Pflicht für alles
 * hinter dem Auth-Gate), `focus` fokussiert das Element vor der Messung.
 */
const CHECKS = [
  [
    '/login',
    'button[type="submit"]',
    'Anmelde-Button (pressableH + eigene Klasse)',
    {
      fontFamily: '-apple-system',
      fontSize: '17px',
      fontWeight: '600',
      backgroundColor: 'rgb(63, 191, 99)',
      color: 'rgb(11, 15, 12)',
      paddingTop: '12px',
    },
  ],
  [
    '/login',
    'h1',
    'Produktname',
    { fontFamily: '-apple-system', fontSize: '32px', fontWeight: '700' },
  ],
  [
    '/login',
    'input[type="email"]',
    'E-Mail-Feld',
    { fontFamily: '-apple-system', fontSize: '15px' },
  ],
  [
    '/login',
    'a[role="link"], button[role="link"]',
    'Rechtslink (pressable + eigene Klasse)',
    { fontFamily: '-apple-system', fontSize: '11px', color: 'rgb(155, 170, 156)' },
  ],
  /*
   * Der einzige Eintrag, der einen ZUSTAND misst. Grund: ein <textarea> ohne
   * eigene Fokusregel bekommt den Ring des Browsers, und der ist in Chrome
   * die blaue Systemakzentfarbe — im Ruhezustand ist davon nichts zu sehen,
   * ein Blick in den Diff zeigt es auch nicht. Erwartet wird deshalb beides:
   * der Rahmen in der Akzentfarbe der App UND ein abgeschalteter Ring.
   */
  [
    '/feedback',
    'textarea',
    'Feedback-Textfeld im Fokus',
    { borderColor: 'rgb(63, 191, 99)', outlineStyle: 'none' },
    { session: true, focus: true },
  ],
];

const browser = await chromium.launch();
const rows = [];
let failures = 0;

for (const [pathname, selector, label, expected, options = {}] of CHECKS) {
  const context = await browser.newContext();
  if (options.session) {
    await context.addInitScript(() => {
      localStorage.setItem(
        'kickflow.session.v1',
        JSON.stringify({ token: 'v', refreshToken: null }),
      );
      // Wie unten im Schrift-Sweep: der Installations-Hinweis würde das
      // gemessene Element sonst hinter einem Dialog verdecken.
      localStorage.setItem('kickflow.installHint.v1', '1');
    });
  }
  const page = await context.newPage();
  await page.goto(BASE + pathname, { waitUntil: 'networkidle' });
  if (options.focus) await page.focus(selector);
  const actual = await page.evaluate(
    ([sel, props]) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return Object.fromEntries(props.map((p) => [p, cs[p]]));
    },
    [selector, Object.keys(expected)],
  );
  await context.close();

  for (const [prop, want] of Object.entries(expected)) {
    // fontFamily nur am ersten Eintrag vergleichen — der Rest des Stacks ist
    // Fallback und für die Aussage unerheblich.
    const got = actual?.[prop] ?? '(Element fehlt)';
    const value = prop === 'fontFamily' ? String(got).split(',')[0].replace(/^"|"$/g, '') : got;
    const ok = value === want;
    if (!ok) failures++;
    rows.push({ Seite: pathname, Element: label, Eigenschaft: prop, ist: value, soll: want, ok });
  }
}

/**
 * Und der Gegencheck über ALLE Seiten: kein einziges Element darf in einer
 * Serifenschrift rendern. Genau das war der Ausgangsfehler — react-native-web
 * gab jedem `<Text>` `font: '14px System'`, im RN-Code stand deshalb nirgends
 * ein `fontFamily`, und der Port setzte gar keines.
 *
 * `session: false` nur für die öffentliche Startseite: mit Session leitet `/`
 * auf die Ligenliste um, die Seite käme also nie unter das Messgerät. Sie ist
 * dabei die einzige mit Fließtext über mehrere Absätze — also die, auf der
 * eine falsche Schrift am meisten auffiele.
 */
const URLS = [
  ['/', { session: false }],
  '/login',
  '/leagues',
  '/settings',
  '/feedback',
  '/42/lineup',
  '/42/players',
  '/42/market',
  '/42/league',
  '/42/more',
  '/42/player/99',
  '/42/manager/7',
  '/42/rules',
  '/42/fixtures',
];

for (const entry of URLS) {
  const [pathname, { session = true } = {}] = Array.isArray(entry) ? entry : [entry, {}];
  const context = await browser.newContext();
  await context.addInitScript((withSession) => {
    if (withSession) {
      localStorage.setItem(
        'kickflow.session.v1',
        JSON.stringify({ token: 'v', refreshToken: null }),
      );
    }
    // Wie in deep-links.mjs: der Installations-Hinweis (src/pwa/) würde die
    // gemessenen Elemente sonst hinter einem Dialog verdecken.
    localStorage.setItem('kickflow.installHint.v1', '1');
  }, session);
  const page = await context.newPage();
  await page.goto(BASE + pathname, { waitUntil: 'networkidle' });
  const serif = await page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => el.textContent?.trim())
      .map((el) => getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/^"|"$/g, ''))
      .filter((f) => !f.startsWith('-apple-system'))
      .slice(0, 3),
  );
  await context.close();
  const ok = serif.length === 0;
  if (!ok) failures++;
  rows.push({
    Seite: pathname,
    Element: 'alle Textknoten',
    Eigenschaft: 'fontFamily',
    ist: ok ? '-apple-system' : serif.join(', '),
    soll: '-apple-system',
    ok,
  });
}

console.table(rows);
await browser.close();

if (failures) {
  console.log(`\n${failures} Abweichung(en).`);
  process.exit(1);
}
console.log('\nAlle berechneten Stile entsprechen der Absicht.');
