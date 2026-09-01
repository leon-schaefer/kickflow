/**
 * Reine Helfer für die Transfermarkt-Liste (Wert-Tab, Markt-Segment) — hält den
 * Screen dumm, damit Filter und Sortierung isoliert testbar bleiben.
 *
 * Beide Funktionen sind generisch über die optionalen Gebots-/Ablauffelder, die
 * `ValueRowPlayer` bereits deklariert — so kommt der Screen ohne Casts auf
 * `MarketPlayer` aus.
 */

/**
 * Aufschlag des Angebotspreises auf den Marktwert, in ganzen Prozent:
 * 12,4 Mio gefordert bei 9,8 Mio Marktwert → 27. Negativ = unter Marktwert.
 *
 * `null`, wenn es nichts zu zeigen gibt: kein eigener Angebotspreis (Kader-
 * Segment), Marktwert 0 (kein sinnvoller Bezugspunkt) oder ein Aufschlag, der
 * auf 0 % rundet — dann ist der Preis faktisch der Marktwert.
 */
export function marketMarkupPercent(
  price: number | undefined,
  marketValue: number,
): number | null {
  if (price === undefined || marketValue <= 0) return null;
  const percent = Math.round(((price - marketValue) / marketValue) * 100);
  return percent === 0 ? null : percent;
}

export type ValueSortKey = "avg" | "total" | "perMinute" | "expiry";

/**
 * Welcher der 3 Wert-Scores (Ø/Mio, Ges/Mio, P/Min) rechts oben in `ValueRow`
 * steht — der gerade aktive Sortier-Wert. `expiry` hat keinen eigenen Score
 * unter diesen 3 (die Restlaufzeit steht bereits separat neben dem
 * Spielernamen), fällt also wie der Default auf Ø/Mio zurück.
 */
export function filteredScoreKey(
  sortKey: ValueSortKey,
): "avg" | "total" | "perMinute" {
  switch (sortKey) {
    case "total":
      return "total";
    case "perMinute":
      return "perMinute";
    default:
      return "avg";
  }
}

/** Nur Listings, auf die ich selbst geboten habe (Rohfeld `uop`, siehe mappers.ts). */
export function filterOwnBids<T extends { ownOfferPrice?: number | null }>(
  players: readonly T[],
): T[] {
  return players.filter((player) => player.ownOfferPrice != null);
}

/**
 * Restlaufzeit aufsteigend — was zuerst ausläuft, steht oben. Manager-Listings
 * laufen nie ab (`expiresInSeconds === null`) und rutschen als Infinity ans
 * Ende; unter ihnen erhält die stabile Sortierung die Reihenfolge der API.
 */
export function sortByExpiry<T extends { expiresInSeconds?: number | null }>(
  players: readonly T[],
): T[] {
  const expiry = (player: T) => player.expiresInSeconds ?? Number.POSITIVE_INFINITY;
  return [...players].sort((a, b) => expiry(a) - expiry(b));
}
