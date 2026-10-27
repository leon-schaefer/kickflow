/**
 * Formgewichteter Punkte-Schnitt für Optimizer und Kaufempfehlung.
 *
 * Bewusst dieselbe Heuristik-Linie wie `difficultyFactor` in
 * fixtureDifficulty.ts: grob, offline, erklärbar — kein kalibriertes Modell.
 * Das Spielerprofil behält den flachen Saison-Ø (`pointAverages`); hier zählen
 * jüngere bestätigte Spieltage stärker, damit ein Aufwärtstrend vor einem
 * abgekühlten Saisonschnitt steht und umgekehrt.
 */

/** Gewicht des jeweils älteren Spiels relativ zum neueren (`decay^(Abstand)`). */
export const FORM_DECAY = 0.85;

/** Maximal so viele der jüngsten Spiele fließen in die Form ein. */
export const FORM_WINDOW = 8;

/**
 * Unter dieser Anzahl bestätigter Spiele gibt es keinen Pseudo-Trend — der
 * flache Saison-Ø ist die ehrlichere Aussage.
 */
export const FORM_MIN_MATCHES = 3;

export interface FormWeightedInput {
  points: number;
}

export interface FormWeightedAverage {
  formAverage: number;
  /**
   * Mittel der jüngeren Hälfte minus Mittel der älteren Hälfte im Fenster.
   * Positiv = Punkte steigen zuletzt, negativ = sie fallen. 0 ohne Trendbasis.
   */
  trend: number;
}

/**
 * `matches` chronologisch (ältestes zuerst), idealerweise schon auf das
 * Settle-Fenster und den Spielplan gefiltert (`settledMatchPoints`).
 */
export function formWeightedAverage(
  matches: readonly FormWeightedInput[],
  flatAverage: number,
): FormWeightedAverage {
  if (matches.length < FORM_MIN_MATCHES) {
    return { formAverage: flatAverage, trend: 0 };
  }

  const window = matches.length > FORM_WINDOW ? matches.slice(-FORM_WINDOW) : matches;
  let weightSum = 0;
  let pointSum = 0;
  for (let i = 0; i < window.length; i++) {
    // Jüngstes Spiel (i = n-1) → Gewicht 1; ältestes → decay^(n-1).
    const weight = FORM_DECAY ** (window.length - 1 - i);
    weightSum += weight;
    pointSum += window[i]!.points * weight;
  }

  const mid = Math.floor(window.length / 2);
  const older = window.slice(0, mid);
  const newer = window.slice(mid);
  const mean = (rows: readonly FormWeightedInput[]) =>
    rows.reduce((sum, row) => sum + row.points, 0) / rows.length;
  const trend = older.length > 0 && newer.length > 0 ? mean(newer) - mean(older) : 0;

  return {
    formAverage: weightSum > 0 ? pointSum / weightSum : flatAverage,
    trend,
  };
}
