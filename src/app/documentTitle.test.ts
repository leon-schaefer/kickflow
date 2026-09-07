import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_NAME, DEFAULT_TITLE, buildDocumentTitle } from './documentTitle';

/**
 * Die Fallunterscheidungen, an denen eine Titel-Funktion typischerweise
 * „kickflow – kickflow" produziert oder einen leeren Titel setzt.
 */
describe('buildDocumentTitle', () => {
  it('hängt den Produktnamen an den Seitentitel', () => {
    expect(buildDocumentTitle(['Markt'])).toBe('Markt – kickflow');
  });

  it('nimmt den INNERSTEN Titel der Kette', () => {
    // `useMatches()` liefert von außen nach innen; die spezifischste Route
    // gewinnt. Ohne diese Regel trüge jeder Tab den Titel seines Layouts.
    expect(buildDocumentTitle(['Meine Ligen', 'Aufstellung'])).toBe('Aufstellung – kickflow');
  });

  it('überspringt Layout-Routen ohne Titel', () => {
    // RequireAuth, TabsLayout und LeagueLayout tragen keinen — sie erscheinen
    // nicht einmal in der URL.
    expect(buildDocumentTitle([undefined, undefined, 'Regeln', undefined])).toBe(
      'Regeln – kickflow',
    );
  });

  it('fällt ohne jeden Titel auf den Standardtitel zurück', () => {
    expect(buildDocumentTitle([])).toBe(DEFAULT_TITLE);
    expect(buildDocumentTitle([undefined])).toBe(DEFAULT_TITLE);
    // Ein leerer oder nur aus Leerzeichen bestehender Titel ist kein Titel —
    // sonst stünde „ – kickflow" im Tab.
    expect(buildDocumentTitle([''])).toBe(DEFAULT_TITLE);
    expect(buildDocumentTitle(['   '])).toBe(DEFAULT_TITLE);
  });

  it('doppelt den Produktnamen nicht', () => {
    // Der klassische Fehler: „kickflow – kickflow" bzw.
    // „kickflow – Aufstellung … – kickflow".
    expect(buildDocumentTitle([APP_NAME])).toBe(DEFAULT_TITLE);
    expect(buildDocumentTitle([DEFAULT_TITLE])).toBe(DEFAULT_TITLE);
    expect(buildDocumentTitle(['Markt'])).not.toContain('kickflow – kickflow');
  });

  it('trimmt den Titel der Route', () => {
    expect(buildDocumentTitle([' Markt '])).toBe('Markt – kickflow');
  });

  it('hält den Standardtitel deckungsgleich mit der index.html', () => {
    // Die einzige Kopie dieses Textes. Der `<title>` im HTML ist, was ein
    // Crawler und der erste Frame sehen; DEFAULT_TITLE ist, was React danach
    // setzt. Laufen sie auseinander, wechselt der Tab-Titel beim Laden
    // sichtbar — und im Suchergebnis steht ein anderer Text als in der App.
    const html = readFileSync(
      path.join(import.meta.dirname, '..', '..', 'index.html'),
      'utf8',
    );
    const htmlTitle = /<title>([^<]*)<\/title>/.exec(html)?.[1];
    expect(htmlTitle).toBe(DEFAULT_TITLE);
  });

  it('nennt im Standardtitel, was die App tut', () => {
    // Die Startseite ist die Zeile, die in einem Suchergebnis steht — der
    // Name allein sagt dort niemandem etwas.
    expect(DEFAULT_TITLE).toContain(APP_NAME);
    expect(DEFAULT_TITLE).toContain('Kickbase');
    expect(DEFAULT_TITLE.length).toBeGreaterThan(APP_NAME.length + 10);
    // Google schneidet Titel jenseits von rund 60 Zeichen ab. Etwas Luft nach
    // oben, aber nicht beliebig.
    expect(DEFAULT_TITLE.length).toBeLessThanOrEqual(70);
  });
});
