import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderRobotsTxt, renderSitemapXml } from '../../scripts/write-seo-files';
import { PRIVACY_PATH, TERMS_PATH } from '@/legal/legalRoutes';
import { routes } from '@/routes/routes';

/**
 * Wächter über robots.txt und sitemap.xml.
 *
 * Beide Dateien sind generiert (scripts/write-seo-files.ts) und NICHT
 * eingecheckt, weil ihr Inhalt an der Umgebung hängt. Geprüft werden deshalb
 * die reinen Render-Funktionen — dasselbe Muster wie
 * src/theme/tokens.css.test.ts für den Token-Generator.
 *
 * Der wichtigste Test ist der letzte: er liest den echten Route-Baum und
 * verlangt, dass die beiden Rechtsseiten dort ÖFFENTLICH hängen. Eine
 * sitemap.xml, die auf eine Route hinter dem Auth-Gate zeigt, schickt jeden
 * Crawler auf eine Weiterleitung — und zwar bei genau den zwei Seiten, deren
 * Erreichbarkeit gefordert ist.
 */
describe('robots.txt', () => {
  const ORIGIN = 'https://kickflow.example';

  it('sperrt die Routen hinter dem Login', () => {
    const txt = renderRobotsTxt(ORIGIN, true);
    for (const blocked of ['/login', '/leagues', '/settings']) {
      expect(txt).toContain(`Disallow: ${blocked}`);
    }
    // Die Liga-Tabs liegen hinter einem dynamischen Segment und werden über
    // eine Wildcard gesperrt.
    for (const tab of ['lineup', 'players', 'market', 'league', 'more']) {
      expect(txt).toContain(`Disallow: /*/${tab}`);
    }
  });

  it('lässt Startseite und Rechtsseiten zu', () => {
    const txt = renderRobotsTxt(ORIGIN, true);
    // `/$` ist das Muster für „genau die Startseite" — ohne den Anker würde
    // `Allow: /` jedes Disallow darüber aushebeln.
    expect(txt).toContain('Allow: /$');
    expect(txt).toContain(`Allow: ${PRIVACY_PATH}`);
    expect(txt).toContain(`Allow: ${TERMS_PATH}`);
  });

  it('nennt die Sitemap mit absoluter URL', () => {
    // Die robots.txt-Spezifikation verlangt hier eine absolute URL; ein
    // relativer Pfad wird ignoriert.
    expect(renderRobotsTxt(ORIGIN, true)).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it('lässt die Sitemap-Zeile weg, wenn keine Domain bekannt ist', () => {
    const txt = renderRobotsTxt(null, true);
    expect(txt).not.toMatch(/^Sitemap:/m);
    // Statt einer geratenen Domain steht dort die Begründung.
    expect(txt).toContain('VERCEL_PROJECT_PRODUCTION_URL');
  });

  it('sperrt auf einem Preview-Deploy ALLES', () => {
    const txt = renderRobotsTxt(ORIGIN, false);
    expect(txt).toContain('Disallow: /');
    // Nichts freigeben und keine Sitemap anbieten: ein Feature-Branch soll
    // nicht mit der Produktionsdomain um dieselben Inhalte konkurrieren.
    expect(txt).not.toMatch(/^Allow:/m);
    expect(txt).not.toMatch(/^Sitemap:/m);
  });
});

describe('sitemap.xml', () => {
  const ORIGIN = 'https://kickflow.example';
  const xml = renderSitemapXml(ORIGIN, '2026-09-07');

  it('ist wohlgeformtes XML mit dem richtigen Namensraum', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    // Gleich viele öffnende wie schließende <url>-Elemente.
    expect(xml.match(/<url>/g)?.length).toBe(xml.match(/<\/url>/g)?.length);
  });

  it('führt genau die öffentlichen Seiten mit absoluter URL', () => {
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([`${ORIGIN}/`, `${ORIGIN}${PRIVACY_PATH}`, `${ORIGIN}${TERMS_PATH}`]);
    // Kein Eintrag ohne Schema — <loc> muss absolut sein.
    for (const loc of locs) expect(loc.startsWith('https://')).toBe(true);
  });

  it('nennt keine Route, die ein Login verlangt', () => {
    for (const blocked of ['/leagues', '/settings', '/lineup', '/market', '/login']) {
      expect(xml, `${blocked} gehört nicht in die Sitemap`).not.toContain(`<loc>${ORIGIN}${blocked}`);
    }
  });
});

describe('Kopplung an den Route-Baum', () => {
  /**
   * Die Pfade der Routen, die AUSSERHALB des Auth-Gates liegen.
   *
   * `RequireAuth` ist eine pathless Layout-Route: sie hat kein `path`, aber
   * `children`. Öffentlich ist also alles, was ein direktes Kind der
   * Wurzelroute ist — und nicht in diesem Block steckt.
   */
  function publicPaths(): string[] {
    const root = routes[0];
    const gate = root.children?.find((c) => !c.path && c.children);
    const gatedPaths = new Set(gate?.children?.map((c) => c.path));
    return (root.children ?? [])
      .filter((c) => c.path && c.path !== '*' && !gatedPaths.has(c.path))
      .map((c) => `/${c.path}`);
  }

  it('hat beide Rechtsseiten öffentlich, nicht hinter dem Auth-Gate', () => {
    const open = publicPaths();
    expect(open).toContain(PRIVACY_PATH);
    expect(open).toContain(TERMS_PATH);
  });

  it('nennt in der Sitemap nur Pfade, die es im Route-Baum gibt', () => {
    // Gegenprobe zur Auslassung: eine Sitemap-URL, die auf einen 404 führt,
    // ist schlimmer als eine fehlende.
    const open = new Set([...publicPaths(), '/']);
    const locs = [...renderSitemapXml('https://x.test', '2026-01-01').matchAll(
      /<loc>https:\/\/x\.test([^<]*)<\/loc>/g,
    )].map((m) => m[1] || '/');
    for (const loc of locs) {
      expect(open.has(loc), `${loc} steht in der Sitemap, aber nicht öffentlich im Route-Baum`).toBe(
        true,
      );
    }
  });

  it('liest die Pfade aus legalRoutes.ts und nicht als Literal', () => {
    // Sonst zeigt die Sitemap nach einem Umbenennen auf einen 404. Geprüft am
    // Quelltext, weil das Ergebnis bei übereinstimmenden Werten gleich
    // aussieht.
    const source = readFileSync(
      path.join(import.meta.dirname, '..', '..', 'scripts', 'write-seo-files.ts'),
      'utf8',
    );
    expect(source).toContain("from '../src/legal/legalRoutes'");
    expect(source).not.toContain("'/datenschutz'");
    expect(source).not.toContain("'/nutzungsbedingungen'");
  });
});
