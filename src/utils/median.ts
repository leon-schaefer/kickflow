/**
 * Median einer Zahlenreihe. Ein eigenes Modul für fünf Zeilen, weil zwei
 * Empfehlungs-Module denselben Bezugswert brauchen und ihn nicht getrennt
 * definieren sollen: `sellAdvice.ts` nimmt den Median der Marktwerte als
 * "teuer"-Schwelle, `replacementAdvice.ts` den Median der Ø-Punkte/Mio als
 * Effizienz-Maßstab des eigenen Kaders. Zwei Kopien wären zwei Stellen, an
 * denen der Umgang mit gerader Länge oder leerer Eingabe auseinanderlaufen
 * kann.
 *
 * Leere Eingabe → 0 und kein `null`: beide Aufrufer benutzen den Wert als
 * Schwelle, und "keine Schwelle" ist bei einem leeren Kader dasselbe wie 0.
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}
