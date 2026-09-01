/**
 * Reine Helfer für die Transfermarkt-Liste (Wert-Tab, Markt-Segment) — hält den
 * Screen dumm, damit Filter und Sortierung isoliert testbar bleiben.
 *
 * Beide Funktionen sind generisch über die optionalen Gebots-/Ablauffelder, die
 * `ValueRowPlayer` bereits deklariert — so kommt der Screen ohne Casts auf
 * `MarketPlayer` aus.
 */

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
