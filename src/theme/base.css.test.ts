import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Wächter über die eine globale Regel.
 *
 * Anlass ist ein echter Fehler aus dem Umzug: react-native-web gab jedem
 * `<Text>` den Basisstil `font: '14px System'`, im ganzen RN-Code stand
 * deshalb kein einziges `fontFamily` — und der Port hat die Schrift zunächst
 * gar nicht gesetzt. Ohne RNW fällt der Browser auf eine SERIFENSCHRIFT
 * zurück, was jede Seite betrifft und in keinem Unit-Test auffällt (jsdom
 * rechnet kein Layout und rendert keine Glyphen).
 *
 * Deshalb hier eine Prüfung auf die Deklaration selbst: sie kostet nichts und
 * fängt genau die Art von Verlust, die sonst erst im Browser sichtbar wird.
 */
const CSS = readFileSync(path.join(import.meta.dirname, 'base.css'), 'utf8');

describe('base.css', () => {
  it('setzt die Schriftfamilie am body — sonst rendert der Browser Serifen', () => {
    expect(CSS).toMatch(/body\s*\{[^}]*font-family:\s*var\(--font-family-base\)/);
  });

  it('setzt die Erbgröße am body', () => {
    // Für Container, deren Kinder keine eigene Rolle setzen; RNWs `<Text>`
    // brachte dafür 14px mit.
    expect(CSS).toMatch(/body\s*\{[^}]*font-size:\s*var\(--font-size-base\)/);
  });

  it('setzt border-box global — RN kennt nur das', () => {
    expect(CSS).toMatch(/box-sizing:\s*border-box/);
  });
});
