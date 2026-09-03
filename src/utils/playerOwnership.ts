/**
 * Herkunftshinweise für die Zeilen des Spieler-Tabs: welche Spieler aus dem
 * competition-weiten Bestand stehen im eigenen Kader, welche sind gerade im
 * Transfermarkt der Liga gelistet.
 *
 * Der Bestand selbst (`getCompetitionPlayers`) weiß davon nichts — er ist
 * competition-, nicht liga-bezogen. Beides wird deshalb aus den ohnehin
 * geladenen Liga-Queries (useLineup/useMarket) hinzugefügt, statt dafür einen
 * weiteren Request zu fahren. Reiner Helfer, damit die Zuordnung ohne UI
 * testbar bleibt (Vorbild: playerFilter.ts).
 */

export interface PlayerOrigin {
  /** Gehört mir — steht in meinem Kader. */
  mine: boolean;
  /** Ist aktuell im Transfermarkt der Liga gelistet (von mir, einem Rivalen oder Kickbase). */
  onMarket: boolean;
}

/**
 * playerId → Herkunft. Enthält NUR Spieler, auf die mindestens einer der
 * beiden Hinweise zutrifft — für alle übrigen gibt es nichts anzuzeigen, und
 * eine Map über alle ~500 Spieler wäre reiner Ballast.
 *
 * Die Hinweise schließen sich nicht aus: ein eigener Spieler, den ich selbst
 * gelistet habe, ist beides.
 */
export function playerOrigins(
  squadPlayerIds: readonly string[],
  marketPlayerIds: readonly string[],
): Map<string, PlayerOrigin> {
  const origins = new Map<string, PlayerOrigin>();
  for (const id of squadPlayerIds) {
    origins.set(id, { mine: true, onMarket: false });
  }
  for (const id of marketPlayerIds) {
    const existing = origins.get(id);
    origins.set(id, { mine: existing?.mine ?? false, onMarket: true });
  }
  return origins;
}
