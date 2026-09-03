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
 *
 * Weiter unten steht mit resolvePlayerOwner() die Kür dazu: nicht nur "gehört
 * mir / ist gelistet", sondern WELCHEM Manager ein Spieler gehört.
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

export type PlayerOwnerKind = 'me' | 'manager' | 'free' | 'unknown';

export interface PlayerOwnerInfo {
  kind: PlayerOwnerKind;
  /** Managername bei 'manager', sonst null. */
  name: string | null;
  /** User-ID bei 'manager', wenn bekannt — erlaubt den Sprung in die Manager-Ansicht. */
  userId: string | null;
  /** Steht aktuell im Transfermarkt der Liga — unabhängig davon, wer ihn besitzt. */
  onMarket: boolean;
}

/** Ein Listing aus `useMarket` — `sellerName`/`sellerId` null = Kickbase-Angebot ohne Manager. */
export interface MarketListing {
  playerId: string;
  sellerName: string | null;
  sellerId: string | null;
}

/** Ein Ranglisten-Eintrag aus `useLeagueRanking`: Manager samt seiner Startelf. */
export interface ManagerLineup {
  userId: string;
  userName: string;
  /** Startelf-IDs, `null` = leerer Slot. NUR die Elf, nicht der ganze Kader. */
  lineupPlayerIds: readonly (string | null)[];
}

export interface OwnerSources {
  /** IDs meines eigenen Kaders (useLineup). */
  squadPlayerIds: readonly string[];
  marketListings: readonly MarketListing[];
  managerLineups: readonly ManagerLineup[];
}

/**
 * Wem ein Spieler gehört, ausschließlich aus belegten Quellen abgeleitet.
 * Kickbase hat für die Liga-Spieleransicht KEIN verifiziertes Besitzerfeld
 * (siehe rawPlayerDetailSchema), deshalb diese Kette — in dieser Reihenfolge,
 * weil jede Stufe verlässlicher ist als die nächste:
 *
 * 1. Mein eigener Kader — direkt aus `/squad`, unstrittig.
 * 2. Ein Transfermarkt-Listing: der Verkäufer IST der Besitzer. Fehlt ein
 *    Verkäufer, ist es ein Kickbase-Angebot — dann gehört der Spieler
 *    tatsächlich keinem Manager ('free'), das ist eine echte Aussage und kein
 *    Nichtwissen.
 * 3. Die Startelf eines Managers aus der Rangliste (`lp[]`).
 *
 * Greift keine Stufe, bleibt es bei 'unknown' — und das heißt wirklich
 * "unbekannt", NICHT "frei": Kickbase legt von fremden Managern nur die
 * Startelf offen, ein Bankspieler eines Rivalen ist von einem vereinslosen
 * Spieler hier nicht zu unterscheiden. Ein "frei" zu behaupten wäre die
 * schlechtere Antwort als zuzugeben, dass wir es nicht wissen.
 */
export function resolvePlayerOwner(playerId: string, sources: OwnerSources): PlayerOwnerInfo {
  const listing = sources.marketListings.find((entry) => entry.playerId === playerId) ?? null;
  const onMarket = listing !== null;

  if (sources.squadPlayerIds.includes(playerId)) {
    return { kind: 'me', name: null, userId: null, onMarket };
  }

  if (listing) {
    // Verkäufername kann fehlen, während die ID da ist — dann über die
    // Rangliste nachschlagen, statt "ein Manager" anzuzeigen.
    const nameFromRanking = sources.managerLineups.find((entry) => entry.userId === listing.sellerId)?.userName;
    const name = listing.sellerName ?? nameFromRanking ?? null;
    if (name || listing.sellerId) {
      return { kind: 'manager', name, userId: listing.sellerId, onMarket };
    }
    return { kind: 'free', name: null, userId: null, onMarket };
  }

  for (const lineup of sources.managerLineups) {
    if (lineup.lineupPlayerIds.includes(playerId)) {
      return { kind: 'manager', name: lineup.userName, userId: lineup.userId, onMarket };
    }
  }

  return { kind: 'unknown', name: null, userId: null, onMarket };
}
