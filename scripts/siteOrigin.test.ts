import { describe, expect, it } from 'vitest';
import { LOCAL_ORIGIN, resolveSiteOrigin } from './siteOrigin';

/**
 * Erster Test unter scripts/ — die Datei entscheidet, worauf die
 * Vorschaukarte jedes geteilten Links zeigt, und ihr Fehlerfall (falsche
 * Herkunft) ist im Browser unsichtbar.
 */
describe('resolveSiteOrigin', () => {
  it('nimmt VITE_SITE_URL vor allem anderen', () => {
    expect(
      resolveSiteOrigin({
        VITE_SITE_URL: 'https://kickflow.example',
        VERCEL_PROJECT_PRODUCTION_URL: 'projekt.vercel.app',
        VERCEL: '1',
      }),
    ).toBe('https://kickflow.example');
  });

  it('ergänzt das fehlende Schema der Vercel-Variablen', () => {
    // Vercel liefert den nackten Host — ohne Schema ist das für `new URL`
    // keine URL, und ein `og:image` ohne Schema ist für jeden Scraper Müll.
    expect(
      resolveSiteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'projekt.vercel.app', VERCEL: '1' }),
    ).toBe('https://projekt.vercel.app');
  });

  it('wirft Pfad, Query und den Schrägstrich am Ende weg', () => {
    // Die Tags hängen ihren eigenen Pfad an — bliebe hier einer stehen, käme
    // `https://host/unterseite//og-image.png` heraus.
    expect(resolveSiteOrigin({ VITE_SITE_URL: 'https://kickflow.example/start?a=1' })).toBe(
      'https://kickflow.example',
    );
    expect(resolveSiteOrigin({ VITE_SITE_URL: 'https://kickflow.example/' })).toBe(
      'https://kickflow.example',
    );
  });

  it('fällt lokal auf die Adresse von serve-dist.mjs zurück', () => {
    expect(resolveSiteOrigin({})).toBe(LOCAL_ORIGIN);
  });

  it('wirft im Vercel-Build, statt localhost auszuliefern', () => {
    // Der ganze Grund für den lauten Zweig: eine Vorschaukarte, die auf
    // localhost zeigt, sieht in CI, im Browser und in den Tests fehlerfrei aus
    // und fällt erst auf, wenn jemand den Link teilt.
    expect(() => resolveSiteOrigin({ VERCEL: '1' })).toThrow(/VITE_SITE_URL/);
    expect(() => resolveSiteOrigin({ VERCEL: '1', VITE_SITE_URL: 'kein  host' })).toThrow(
      /VITE_SITE_URL/,
    );
  });
});
