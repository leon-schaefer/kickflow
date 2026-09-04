import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Wächter über die Duell-Hervorhebung in der Liga-Tabelle.
 *
 * Anlass ist ein echter Fehler: die Trennlinie der Zeilen ist ein
 * Pseudo-Element auf `bottom: 0` und lag damit genau auf dem grünen 1px-Rahmen
 * der Gegner-Zeile — sie überdeckte ihn ab dem Einzug grau, der Rahmen war
 * unten offen. In jsdom fällt das nicht auf (kein Layout, keine Farben),
 * deshalb hier eine Prüfung auf die Regel selbst.
 */
const CSS = readFileSync(path.join(import.meta.dirname, 'LeagueScreen.module.css'), 'utf8');

describe('LeagueScreen.module.css', () => {
  it('nimmt die Trennlinie an der Gegner-Zeile weg — sie liegt auf dem Rahmen', () => {
    expect(CSS).toMatch(/\.rowSlot:has\(\.rowOpponent\)::after[^}]*\{[^}]*content:\s*none/);
  });

  it('nimmt sie auch im Slot darüber weg — dort liegt der obere Rahmen', () => {
    expect(CSS).toMatch(
      /\.rowSlot:has\(\+\s*\.rowSlot\s+\.rowOpponent\)::after[^}]*\{[^}]*content:\s*none/,
    );
  });
});
