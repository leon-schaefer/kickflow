/**
 * Kaufpreis-Bilanz eines eigenen Kaderspielers: was er gekostet hat, was er
 * heute wert ist und wie groß die Differenz ist.
 *
 * Der Kaufpreis selbst steht in keiner Kickbase-Antwort — er wird in
 * `toSquadPlayer` aus `mv − mvgl` abgeleitet (siehe mappers.ts). Hier hängt
 * daran nur noch reine Arithmetik, damit der Screen dumm bleibt.
 */

export interface PurchaseDelta {
  purchasePrice: number;
  /** Aktueller Marktwert − Kaufpreis. Deckungsgleich mit dem Rohfeld `mvgl`. */
  gain: number;
  /** Gerundete ganze Prozent, wie marketMarkupPercent() im Transfermarkt. */
  percent: number;
}

/**
 * `null`, wenn es nichts zu vergleichen gibt: kein bekannter Kaufpreis (der
 * Spieler gehört mir nicht, oder `mvgl` fehlte in der Antwort) oder ein
 * Kaufpreis ≤ 0, der keinen sinnvollen Bezugspunkt für eine Prozentangabe gibt.
 *
 * Ein Gewinn von exakt 0 ist dagegen ein Ergebnis, kein Fehlen: "steht genau
 * auf Kaufpreis" ist eine Aussage und wird als `±0 %` angezeigt.
 */
export function purchaseDelta(
  marketValue: number,
  purchasePrice: number | null,
): PurchaseDelta | null {
  if (purchasePrice === null || purchasePrice <= 0) return null;
  const gain = marketValue - purchasePrice;
  return {
    purchasePrice,
    gain,
    percent: Math.round((gain / purchasePrice) * 100),
  };
}
