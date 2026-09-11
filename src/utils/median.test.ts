import { describe, expect, it } from 'vitest';
import { median } from './median';

/**
 * Klein, aber der Grund für das eigene Modul: zwei Empfehlungs-Module hängen
 * an genau diesen drei Randfällen (gerade Länge, leere Eingabe, unsortierte
 * Eingabe). Vorher stand die Funktion lokal in sellAdvice.ts.
 */
describe('median', () => {
  it('nimmt bei ungerader Länge den Mittelwert der Reihe', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('mittelt bei gerader Länge die beiden mittleren Werte', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('sortiert selbst — die Eingabereihenfolge zählt nicht', () => {
    expect(median([10, 1, 5, 2])).toBe(3.5);
  });

  it('lässt die Eingabe unverändert', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });

  it('liefert für eine leere Reihe 0 statt null — "keine Schwelle" ist hier 0', () => {
    expect(median([])).toBe(0);
  });
});
