/**
 * Kickbase-„33 %-Regel" für den maximal erlaubten Kontostand im Minus.
 * Quelle: https://help.kickbase.com/help/wie-weit-darf-ich-ins-minus
 *
 *   Untergrenze = −rate × (Mannschaftswert + min(Kontostand, 0))
 *
 * Wörtliches Beispiel der Kickbase-Hilfe: Mannschaftswert 100 Mio €, Konto
 * −10 Mio € → Basis 100 + (−10) = 90 Mio € → 33 % davon = 30 Mio € → Konto
 * darf nicht unter −30 Mio € fallen. Die Hilfe schreibt „33 %", ihr eigenes
 * Rechenbeispiel geht aber exakt mit 1/3 auf (90 / 3 = 30, nicht 90 × 0,33 =
 * 29,7) — deshalb 1/3 als Konstante, „33 %" bleibt der Text dafür.
 *
 * Wichtig laut Hilfe: die App prüft nicht ein einzelnes Gebot isoliert,
 * sondern die Summe aller aktuell offenen eigenen Gebote zusammen
 * ("Nach Annahme aller Gebote") — deshalb fließt `pendingOffers` mit ein.
 */
export const OVERDRAFT_RATE = 1 / 3;

export interface BudgetLimitInput {
  /** LeagueSummary.budget — der tatsächliche Kontostand (Rohfeld `b` aus /v4/leagues/selection). */
  budget: number;
  /** LeagueSummary.teamValue — der Mannschaftswert der Regel (Rohfeld `tv`). */
  teamValue: number;
  /** Summe der eigenen offenen Gebote auf dem Transfermarkt, siehe sumOpenOffers(). */
  pendingOffers?: number;
}

export interface BudgetLimit {
  budget: number;
  teamValue: number;
  pendingOffers: number;
  /** Erlaubte Untergrenze des Kontostands, ≤ 0. */
  minBalance: number;
  /** Der reine Überziehungsrahmen, −minBalance, ≥ 0. */
  overdraftAllowance: number;
  /** Kontostand, wenn alle offenen Gebote angenommen würden. */
  balanceAfterPendingOffers: number;
  /** Wie viel für ein NEUES Gebot noch Spielraum ist — nie negativ. */
  available: number;
  /** true, wenn der Kontostand die Untergrenze bereits unterschreitet (z.B. durch Marktwertverfall). */
  overLimit: boolean;
  /** Was zum Ausgleich auf einen Kontostand von 0 fehlt — 0, wenn das Konto bereits im Plus ist. */
  deficit: number;
}

export function computeBudgetLimit({ budget, teamValue, pendingOffers = 0 }: BudgetLimitInput): BudgetLimit {
  // Bereits negativer Kontostand erhöht die Bemessungsgrundlage nicht, siehe
  // Rechenbeispiel oben (100 Mio + (−10 Mio), nicht 100 Mio allein).
  const base = teamValue + Math.min(budget, 0);
  // Math.ceil auf einer negativen Zahl rundet zur konservativen (strengeren)
  // Seite — lieber 1 € zu wenig Rahmen anzeigen als 1 € zu viel.
  const minBalance = base > 0 ? Math.ceil(-OVERDRAFT_RATE * base) : 0;
  // `-minBalance` statt `0 - minBalance`: bei minBalance === 0 vermeidet das
  // eine negative Null (-0), die zwar rechnerisch gleich 0 ist, aber in
  // Tests/Vergleichen mit Object.is (z.B. toBe) als ungleich auffällt.
  const overdraftAllowance = minBalance === 0 ? 0 : -minBalance;
  const balanceAfterPendingOffers = budget - pendingOffers;
  const available = Math.max(0, balanceAfterPendingOffers - minBalance);
  const overLimit = balanceAfterPendingOffers < minBalance;
  const deficit = Math.max(0, -budget);

  return {
    budget,
    teamValue,
    pendingOffers,
    minBalance,
    overdraftAllowance,
    balanceAfterPendingOffers,
    available,
    overLimit,
    deficit,
  };
}

/**
 * Summe der eigenen offenen Gebote aus der Marktliste. `excludePlayerId`
 * lässt den Spieler aus, für den gerade neu geboten wird — ein erneutes
 * `POST .../offers` auf denselben Spieler ist ein Upsert (siehe
 * endpoints.ts), das bestehende Gebot darf also nicht doppelt gezählt werden.
 */
export function sumOpenOffers(
  market: readonly { id: string; ownOfferPrice: number | null }[],
  excludePlayerId?: string,
): number {
  return market
    .filter((player) => player.id !== excludePlayerId && player.ownOfferPrice != null)
    .reduce((sum, player) => sum + (player.ownOfferPrice ?? 0), 0);
}
