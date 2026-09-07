/**
 * Schreibt public/robots.txt und public/sitemap.xml vor jedem Web-Build.
 *
 * Läuft aus `build:web` heraus, genau wie write-build-id.ts, und beide
 * Ausgaben sind aus demselben Grund gitignored: ihr Inhalt hängt an der
 * Umgebung (Domain, Production vs. Preview) und nicht am Quelltext. Eine
 * eingecheckte robots.txt wäre in einem Preview-Deploy falsch.
 *
 * ## Was hier indexiert wird — und was nicht
 *
 * kickflow ist eine App hinter einem Login. Von den 15 Routen haben genau
 * vier für einen Crawler überhaupt Inhalt: die Startseite, der Login und die
 * beiden Rechtsseiten. Alle anderen (`/:leagueId/lineup`,
 * `/:leagueId/player/:playerId` …) verlangen ein Kickbase-Konto und liefern
 * ohne Session nur eine Weiterleitung auf den Login.
 *
 * Sie zu sperren ist deshalb nicht Geheimniskrämerei, sondern korrekt: ein
 * Crawler, der `/42/market` abruft, bekommt denselben Login wie bei
 * `/99/market` und indexiert dieselbe Seite unter beliebig vielen URLs. Der
 * Catch-All-Rewrite in vercel.json macht diese Menge unendlich — jeder Pfad
 * liefert HTTP 200 mit dem App-Rumpf, auch `/gibt-es-nicht`. Ohne `Disallow`
 * lädt ein Crawler beliebig viele URLs mit identischem Inhalt.
 *
 * ## Preview-Deploys
 *
 * Auf einer Preview-URL wird ALLES gesperrt. Sonst konkurriert jeder
 * Feature-Branch mit der Produktionsdomain um dieselben Inhalte — der
 * klassische Weg, sich seine eigene Seite aus dem Index zu verdrängen. Das
 * canonical zeigt zwar auf Produktion (siehe scripts/siteUrl.ts), aber
 * `Disallow` ist die verlässlichere Bremse.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PRIVACY_PATH, TERMS_PATH } from '../src/legal/legalRoutes';
import { isProductionDeploy, isVercelBuild, resolveSiteOrigin } from './siteUrl';

const PUBLIC_DIR = path.join(import.meta.dirname, '..', 'public');

/**
 * Die öffentlich sinnvollen Pfade, in der Reihenfolge ihrer Wichtigkeit.
 *
 * `/login` steht bewusst NICHT drin: die Seite hat für eine Suchanfrage keinen
 * Wert („kickflow anmelden" führt genauso gut auf `/`), und `/` leitet
 * ohnehin dorthin um, wenn niemand angemeldet ist. Ein Formular als
 * Suchergebnis ist ein schlechtes Suchergebnis.
 *
 * Die Rechtsseiten kommen aus legalRoutes.ts und nicht als Literal: sonst
 * zeigt die sitemap.xml nach einem Umbenennen auf einen 404, und zwar bei
 * genau den zwei Seiten, deren Erreichbarkeit gefordert ist.
 */
const PUBLIC_PATHS = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: PRIVACY_PATH, changefreq: 'yearly', priority: '0.3' },
  { path: TERMS_PATH, changefreq: 'yearly', priority: '0.3' },
] as const;

/**
 * Pfad-Präfixe, die kein Crawler abrufen soll.
 *
 * `/:leagueId` ist ein dynamisches Segment und als Präfix nicht ausdrückbar —
 * deshalb steht in den Mustern unten eine Wildcard an seiner Stelle, gefolgt
 * vom Tab-Namen (Slash, Stern, Slash, `lineup` usw.). Ausgeschrieben ließe
 * sich das hier nicht notieren: die Zeichenfolge Stern-Slash würde diesen
 * Kommentarblock beenden — was sie einmal getan hat und den Build mit einem
 * Syntaxfehler zehn Zeilen weiter unten zum Stehen brachte.
 * Wildcards mitten im Muster versteht jeder relevante Crawler
 * (Google, Bing, DuckDuckGo); ältere Robots ignorieren die Zeile, und der
 * Schaden ist dann eine Login-Seite im Index, nicht ein Datenleck — hinter
 * diesen Pfaden liegt ohne Token nichts.
 */
const DISALLOWED = [
  '/login',
  '/leagues',
  '/settings',
  '/*/lineup',
  '/*/players',
  '/*/market',
  '/*/league',
  '/*/more',
  '/*/player/',
  '/*/manager/',
  '/*/rules',
  '/*/fixtures',
];

export function renderRobotsTxt(origin: string | null, indexable: boolean): string {
  const lines = ['# Erzeugt von scripts/write-seo-files.ts — nicht von Hand editieren.', ''];

  if (!indexable) {
    lines.push(
      '# Preview-Deploy: nichts indexieren, damit kein Feature-Branch mit der',
      '# Produktionsdomain um dieselben Inhalte konkurriert.',
      'User-agent: *',
      'Disallow: /',
      '',
    );
    return lines.join('\n');
  }

  lines.push(
    '# kickflow ist eine App hinter einem Kickbase-Login. Öffentlich sinnvoll sind',
    '# nur die Startseite und die beiden Rechtsseiten; alles andere liefert ohne',
    '# Session eine Weiterleitung auf den Login. Weil der Catch-All-Rewrite in',
    '# vercel.json JEDEN Pfad mit HTTP 200 beantwortet, wären das sonst beliebig',
    '# viele URLs mit identischem Inhalt.',
    'User-agent: *',
    ...DISALLOWED.map((p) => `Disallow: ${p}`),
    'Allow: /$',
    `Allow: ${PRIVACY_PATH}`,
    `Allow: ${TERMS_PATH}`,
    '',
  );

  if (origin) {
    lines.push(`Sitemap: ${origin}/sitemap.xml`, '');
  } else {
    lines.push(
      '# Keine Sitemap-Zeile: die Spezifikation verlangt dort eine ABSOLUTE URL,',
      '# und zur Build-Zeit war keine Domain bekannt (weder SITE_URL noch',
      '# VERCEL_PROJECT_PRODUCTION_URL gesetzt).',
      '',
    );
  }

  return lines.join('\n');
}

export function renderSitemapXml(origin: string, lastmod: string): string {
  const entries = PUBLIC_PATHS.map(
    ({ path: p, changefreq, priority }) => `  <url>
    <loc>${origin}${p}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Erzeugt von scripts/write-seo-files.ts — nicht von Hand editieren. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

if (import.meta.filename === process.argv[1]) {
  const origin = resolveSiteOrigin();
  // Nur ein Production-Deploy darf indexiert werden. Ein lokaler Build ist
  // kein Deploy — dort ist `VERCEL_ENV` nicht gesetzt, und die Dateien werden
  // trotzdem geschrieben, damit `npm run preview` dasselbe ausliefert wie
  // Produktion.
  const indexable = !isVercelBuild() || isProductionDeploy();

  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), renderRobotsTxt(origin, indexable), 'utf8');
  console.log(`robots.txt geschrieben (indexierbar: ${indexable}, Domain: ${origin ?? 'unbekannt'})`);

  const sitemapPath = path.join(PUBLIC_DIR, 'sitemap.xml');

  if (origin && indexable) {
    const lastmod = new Date().toISOString().slice(0, 10);
    writeFileSync(sitemapPath, renderSitemapXml(origin, lastmod), 'utf8');
    console.log(`sitemap.xml geschrieben: ${PUBLIC_PATHS.length} URLs unter ${origin}`);
  } else {
    // Bewusst KEINE Datei mit relativen Pfaden: eine sitemap.xml ohne
    // absolute `<loc>` ist ungültig, und eine für einen Preview-Deploy soll
    // es gar nicht geben.
    //
    // LÖSCHEN und nicht bloß nicht schreiben: die Datei ist gitignored, ein
    // frischer Klon hat sie also nicht — ein Arbeitsverzeichnis, in dem schon
    // einmal mit gesetzter SITE_URL gebaut wurde, aber schon. Ohne das hier
    // liegt sie noch da, `vite build` kopiert public/ unverändert nach dist/,
    // und der Preview-Deploy liefert eine Sitemap mit Produktions-URLs aus,
    // während seine robots.txt alles sperrt.
    rmSync(sitemapPath, { force: true });
    console.log(
      'sitemap.xml übersprungen — ' +
        (origin ? 'kein Production-Deploy' : 'keine Domain bekannt (SITE_URL setzen)'),
    );
    if (isVercelBuild() && indexable && !origin) {
      console.warn(
        'WARNUNG: Production-Build auf Vercel ohne bekannte Domain. ' +
          'VERCEL_PROJECT_PRODUCTION_URL fehlt — canonical, og:url, og:image und ' +
          'die Sitemap-Zeile entfallen. SITE_URL in den Projekt-Env-Vars setzen.',
      );
    }
  }
}
