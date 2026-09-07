/**
 * Schreibt public/robots.txt und public/sitemap.xml vor jedem Web-Build.
 *
 * Läuft aus `build:web` heraus, genau wie write-build-id.ts, und beide
 * Ausgaben sind aus demselben Grund gitignored: sie enthalten die Domain, und
 * die kennt erst der Build (scripts/siteOrigin.ts).
 *
 * ## Warum die robots.txt hier entsteht, obwohl sie vorher eingecheckt war
 *
 * Die eingecheckte Fassung hatte genau einen Nachteil, und der ist
 * unvermeidbar: die `Sitemap:`-Zeile verlangt laut Spezifikation eine
 * ABSOLUTE URL, ein relativer Pfad wird ignoriert. Eine statische Datei kann
 * sie deshalb nicht enthalten.
 *
 * Die POLITIK der eingecheckten Fassung bleibt dabei unverändert und
 * absichtlich: `User-agent: * / Allow: /`. Sie stammt aus der Runde, die die
 * öffentliche Startseite gebracht hat, mit der Begründung, dass hinter jeder
 * anderen Route der Login liegt und ein Crawler dort nichts als die leere SPA
 * bekommt — das stimmt, und es ist nicht meine Entscheidung, sie zu ändern.
 *
 * Eine `Disallow`-Liste für die App-Routen hätte man erwägen können: der
 * Catch-All-Rewrite in vercel.json beantwortet JEDEN Pfad mit HTTP 200 und der
 * index.html, die Menge indexierbarer URLs ist also unbegrenzt. Dagegen
 * sprechen zwei Dinge, und beide sind stärker: Suchmaschinen indexieren
 * identische leere Hüllen nicht, und für eine Seite dieser Größe ist
 * Crawl-Budget kein Thema. Wer die Liste doch will, sollte sie mit dem
 * Argument einführen, nicht als Beifang einer Sitemap.
 *
 * ## Preview-Deploys
 *
 * Hier steht bewusst KEINE Sonderbehandlung. Der naheliegende Reflex — auf
 * einer Preview-URL alles sperren, damit kein Feature-Branch mit der
 * Produktionsdomain um dieselben Inhalte konkurriert — wäre doppelte Arbeit:
 * Vercel setzt auf Preview-Deployments von sich aus `X-Robots-Tag: noindex`
 * (nachgemessen: die Preview antwortet mit dem Header, die Produktionsdomain
 * nicht). Ein Header ist dabei die verlässlichere Bremse als eine robots.txt,
 * denn er wirkt auch auf einen bereits abgerufenen Pfad.
 *
 * Die Sitemap entsteht trotzdem in jedem Build und trägt die
 * PRODUKTIONS-Domain — auch im Preview. Das ist richtig und derselbe Gedanke
 * wie beim canonical: `VERCEL_PROJECT_PRODUCTION_URL` zeigt immer auf
 * Produktion (siehe scripts/siteOrigin.ts), und eine Sitemap soll die
 * dauerhaften URLs nennen, nicht die eines Deploys.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PRIVACY_PATH, TERMS_PATH } from '../src/legal/legalRoutes';
import { resolveSiteOrigin } from './siteOrigin';

const PUBLIC_DIR = path.join(import.meta.dirname, '..', 'public');

/**
 * Die öffentlich sinnvollen Pfade, in der Reihenfolge ihrer Wichtigkeit.
 *
 * Genau drei — dieselben drei, die im Route-Baum außerhalb von `RequireAuth`
 * hängen: die Startseite (seit der Landing-Page echter Inhalt und nicht nur
 * eine Weiterleitung) und die beiden Rechtsseiten.
 *
 * `/login` steht bewusst NICHT drin: die Seite hat für eine Suchanfrage keinen
 * Wert („kickflow anmelden" führt genauso gut auf `/`), und ein Formular als
 * Suchergebnis ist ein schlechtes Suchergebnis.
 *
 * Die Rechtsseiten kommen aus legalRoutes.ts und nicht als Literal: sonst
 * zeigt die sitemap.xml nach einem Umbenennen auf einen 404, und zwar bei
 * genau den zwei Seiten, deren Erreichbarkeit gefordert ist. seoFiles.test.ts
 * prüft die Kopplung gegen den echten Route-Baum.
 */
const PUBLIC_PATHS = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: PRIVACY_PATH, changefreq: 'yearly', priority: '0.3' },
  { path: TERMS_PATH, changefreq: 'yearly', priority: '0.3' },
] as const;

export function renderRobotsTxt(origin: string): string {
  return [
    '# Erzeugt von scripts/write-seo-files.ts vor jedem Build — nicht von Hand',
    '# editieren. Generiert und nicht eingecheckt, weil die Sitemap-Zeile unten',
    '# eine absolute URL braucht und die Domain erst der Build kennt.',
    '#',
    '# Alles erlaubt — öffentlich sind die Startseite und die beiden',
    '# Rechtsseiten. Jede andere Route liegt hinter dem Login und liefert einem',
    '# Crawler nichts als die leere SPA.',
    '#',
    '# Die Datei muss existieren, obwohl sie nichts verbietet: der',
    '# Catch-All-Rewrite in vercel.json beantwortet einen fehlenden Pfad mit der',
    '# index.html und Status 200 (siehe README). Ohne sie bekäme jeder Crawler',
    '# unter /robots.txt eine HTML-Seite als vermeintliche robots.txt geliefert.',
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
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
  // Dieselbe Auflösung wie für die Open-Graph-Tags, damit canonical, og:url
  // und die Sitemap nicht auseinanderlaufen können. Wirft im Vercel-Build ohne
  // auflösbare Domain — ein roter Build ist billiger als eine Sitemap, die auf
  // localhost zeigt (Begründung in scripts/siteOrigin.ts).
  const origin = resolveSiteOrigin(process.env);
  // Nur das Datum, keine Uhrzeit: `lastmod` mit Sekundengenauigkeit behauptet
  // eine Änderung, die ein Build ohne Inhaltsänderung nicht hergibt.
  const lastmod = new Date().toISOString().slice(0, 10);

  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), renderRobotsTxt(origin), 'utf8');
  writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), renderSitemapXml(origin, lastmod), 'utf8');
  console.log(`robots.txt und sitemap.xml geschrieben: ${PUBLIC_PATHS.length} URLs unter ${origin}`);
}
