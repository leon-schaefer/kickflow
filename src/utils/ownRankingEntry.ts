import type { LeagueRankingEntry } from '@/api/kickbase';

/**
 * Die eigene Zeile in der Liga-Tabelle. An ihr hängt im Liga-Tab mehr als eine
 * Hervorhebung: ohne sie gibt es auch keinen Duell-Gegner und damit keine
 * Duell-Karte (siehe src/screens/LeagueScreen.tsx).
 *
 * Der normale Weg ist die eigene User-ID. Sie kann aber fehlen, ohne dass die
 * Anmeldung fehlt: Sessions von vor der Persistierung im tokenStore tragen sie
 * nicht, und die Login-Antwort liefert `u.id` nur laut unverifizierter Doku
 * (siehe toAuthSession in api/kickbase/mappers.ts). Dann bleibt der eigene
 * Kader als Erkennungsmerkmal — ein Spieler gehört pro Liga genau EINEM
 * Manager, die eigene Elf ist also die einzige, die sich mit dem eigenen Kader
 * überschneiden kann.
 *
 * "Kann", nicht "muss": die `lp[]` der Saisonwertung sind der Stand des zuletzt
 * abgerechneten Spieltags (siehe useLeagueRanking). Ein seither gekaufter
 * Spieler steht dort noch in der Elf des Verkäufers und zählt für dessen Zeile
 * mit. Deshalb der beste Treffer statt des ersten — und bei Gleichstand
 * lieber gar keiner: eine geratene eigene Zeile wäre schlimmer als keine.
 */
export function findOwnRankingEntry(
  entries: readonly LeagueRankingEntry[],
  userId: string | null,
  ownPlayerIds: readonly string[],
): LeagueRankingEntry | null {
  if (userId) return entries.find((entry) => entry.userId === userId) ?? null;
  return matchByOwnSquad(entries, ownPlayerIds);
}

function matchByOwnSquad(
  entries: readonly LeagueRankingEntry[],
  ownPlayerIds: readonly string[],
): LeagueRankingEntry | null {
  if (ownPlayerIds.length === 0) return null;
  const owned = new Set(ownPlayerIds);

  let best: LeagueRankingEntry | null = null;
  let bestCount = 0;
  let runnerUpCount = 0;
  for (const entry of entries) {
    const count = entry.lineupPlayerIds.filter((id) => id !== null && owned.has(id)).length;
    if (count > bestCount) {
      runnerUpCount = bestCount;
      bestCount = count;
      best = entry;
    } else if (count > runnerUpCount) {
      runnerUpCount = count;
    }
  }

  // Kein Treffer (leere Elf) oder Gleichstand: nicht ableitbar.
  return bestCount > runnerUpCount ? best : null;
}
