/**
 * "Punkte pro Million Marktwert" — zwei Varianten, beide werden angezeigt:
 * - Ø-Punkte/Mio spiegelt aktuelle Form wider, unabhängig von der Anzahl
 *   absolvierter Spiele.
 * - Gesamt-Punkte/Mio spiegelt den kompletten Saisonertrag wider, begünstigt
 *   aber Spieler mit vielen Einsätzen/langer Kaderzugehörigkeit.
 */
export function pointsPerMillion(points: number, marketValue: number): number {
  if (marketValue <= 0) return 0;
  return points / (marketValue / 1_000_000);
}
