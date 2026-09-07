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
 * eingecheckt, weil sie die Domain enthalten und die erst der Build kennt.
 * Geprüft werden deshalb die reinen Render-Funktionen — dasselbe Muster wie
 * src/theme/tokens.css.test.ts für den Token-Generator.
 *
 * Der wichtigste Test ist der letzte: er liest den echten Route-Baum und
 * verlangt, dass jede Sitemap-URL dort ÖFFENTLICH hängt. Eine Sitemap, die auf
 * eine Route hinter dem Auth-Gate zeigt, schickt jeden Crawler auf eine
 * Weiterleitung — und das schlimmstenfalls bei den zwei Seiten, deren
 * Erreichbarkeit rechtlich gefordert ist.
 */
const ORIGIN = 'https://kickflow.example';

describe('robots.txt', () => {
  const txt = renderRobotsTxt(ORIGIN);

  it('erlaubt das Crawlen und sperrt nichts', () => {
    // Die Politik ist aus der eingecheckten Fassung übernommen und
    // absichtlich unverändert: hinter jeder Route außer den drei öffentlichen
    // liegt der Login, und dort bekommt ein Crawler nur die leere SPA. Eine
    // Disallow-Liste einzuführen wäre eine eigene Entscheidung mit eigener
    // Begründung — nicht Beifang einer Sitemap.
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Allow: /');
    expect(txt).not.toMatch(/^Disallow:/m);
  });

  it('nennt die Sitemap mit absoluter URL', () => {
    // Der einzige Grund, warum die Datei überhaupt generiert wird: die
    // robots.txt-Spezifikation verlangt hier eine absolute URL, ein relativer
    // Pfad wird ignoriert — eine statische Datei kann das nicht leisten.
    expect(txt).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    expect(txt).not.toContain('Sitemap: /');
  });

  it('erklärt, warum sie existiert', () => {
    // Der Catch-All-Rewrite beantwortet einen fehlenden Pfad mit der
    // index.html und Status 200 — ohne diese Datei bekäme ein Crawler unter
    // /robots.txt eine HTML-Seite. Die Begründung soll in der Datei stehen,
    // weil sie sonst beim nächsten Aufräumen gelöscht wird.
    expect(txt).toContain('Catch-All-Rewrite');
  });
});

describe('sitemap.xml', () => {
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
    for (const blocked of ['/leagues', '/settings', '/feedback', '/lineup', '/market', '/login']) {
      expect(xml, `${blocked} gehört nicht in die Sitemap`).not.toContain(
        `<loc>${ORIGIN}${blocked}`,
      );
    }
  });

  it('datiert auf den Tag und nicht auf die Sekunde', () => {
    // `lastmod` mit Sekundengenauigkeit behauptet eine Änderung, die ein Build
    // ohne Inhaltsänderung nicht hergibt.
    for (const m of xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
      expect(m[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
    const own = (root.children ?? [])
      .filter((c) => c.path && c.path !== '*' && !gatedPaths.has(c.path))
      .map((c) => `/${c.path}`);
    // Die Index-Route hat kein `path`, ist aber `/` — und seit der
    // öffentlichen Startseite echter Inhalt.
    return root.children?.some((c) => c.index) ? ['/', ...own] : own;
  }

  it('hat beide Rechtsseiten öffentlich, nicht hinter dem Auth-Gate', () => {
    const open = publicPaths();
    expect(open).toContain(PRIVACY_PATH);
    expect(open).toContain(TERMS_PATH);
  });

  it('nennt in der Sitemap nur Pfade, die es öffentlich im Route-Baum gibt', () => {
    // Gegenprobe zur Auslassung: eine Sitemap-URL, die auf einen Login
    // umleitet oder auf einen 404 führt, ist schlimmer als eine fehlende.
    const open = new Set(publicPaths());
    const locs = [
      ...renderSitemapXml('https://x.test', '2026-01-01').matchAll(
        /<loc>https:\/\/x\.test([^<]*)<\/loc>/g,
      ),
    ].map((m) => m[1] || '/');
    for (const loc of locs) {
      expect(
        open.has(loc),
        `${loc} steht in der Sitemap, aber nicht öffentlich im Route-Baum`,
      ).toBe(true);
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

  it('benutzt dieselbe Herkunfts-Auflösung wie die Open-Graph-Tags', () => {
    // Zwei Auflösungen wären zwei Domains, die auseinanderlaufen können —
    // canonical/og:url auf der einen, die Sitemap auf der anderen. Es gibt
    // genau eine (scripts/siteOrigin.ts), und die benutzen beide.
    const source = readFileSync(
      path.join(import.meta.dirname, '..', '..', 'scripts', 'write-seo-files.ts'),
      'utf8',
    );
    expect(source).toContain("from './siteOrigin'");
  });
});
