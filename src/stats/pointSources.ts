/**
 * „Von welchem Spieler habe ich eigentlich meine Punkte bekommen?"
 *
 * Kickbase beantwortet das nirgends: der Kader zeigt die Saisonpunkte, die ein
 * Spieler ÜBERHAUPT geholt hat — nicht die, die er MIR gebracht hat. Die
 * beiden Zahlen fallen auseinander, sobald jemand die halbe Saison beim
 * Vorbesitzer stand, auf meiner Bank saß oder längst verkauft ist. Genau
 * dieser Unterschied ist der Punkt der Auswertung.
 *
 * Die Rechnung braucht zwei Quellen und multipliziert sie:
 *
 *   1. Welche elf Spieler standen an Spieltag N in MEINER Elf?
 *      → `/v4/leagues/{id}/ranking?dayNumber=N`, Feld `lp[]` (siehe
 *        getLeagueRankingAtMatchday in api/kickbase/endpoints.ts)
 *   2. Wie viele Punkte hat Spieler X an Spieltag N geholt?
 *      → `/v4/leagues/{id}/players/{pid}/performance`, Feld `ph[].p`
 *
 * Nur Spieltage, an denen der Spieler in meiner Elf STAND, zählen — ein
 * Bankspieler bringt in Kickbase keine Punkte, und genau deshalb ist die
 * Elf-Historie und nicht der Kader die richtige Grundlage.
 *
 * Reine Funktionen ohne React und ohne Netz, Vorbild sellAdvice.ts: die
 * Zuordnung ist der Teil, der falsch sein kann, und soll ohne gerenderten
 * Screen prüfbar bleiben.
 */
import type { Position } from '@/api/kickbase';
import { positionLabels } from '@/theme/tokens';

/** Die Startelf EINES Spieltags, wie sie die Liga-Tabelle zu `dayNumber` meldet. */
export interface MatchdayLineup {
  day: number;
  /** Nur echte IDs — leere Slots (`lp[] === null`) filtert der Aufrufer weg. */
  playerIds: readonly string[];
}

/**
 * Stammdaten eines Spielers für die Auswertung. Für eigene Kaderspieler aus
 * `/squad`, für längst verkaufte aus `getPlayerBasic` — die Auswertung reicht
 * über den heutigen Kader hinaus, sonst fehlte ausgerechnet der im Winter
 * verkaufte Punktelieferant.
 */
export interface StatsPlayerMeta {
  name: string;
  teamId: string;
  position: Position;
  imageUrl: string | null;
}

/** Was ein einzelner Spieler MIR eingebracht hat. */
export interface PointSource {
  playerId: string;
  name: string;
  teamId: string;
  position: Position;
  imageUrl: string | null;
  /** Summe seiner Punkte an den Spieltagen, an denen er in meiner Elf stand. */
  points: number;
  /** Anzahl dieser Spieltage. */
  appearances: number;
  /** `points / appearances` — Punkte je Einsatz IN MEINER ELF. */
  averagePoints: number;
}

export interface PointSourceInput {
  lineups: readonly MatchdayLineup[];
  /** playerId → (Spieltag → Punkte GENAU dieses Spieltags). */
  pointsByPlayer: ReadonlyMap<string, ReadonlyMap<number, number>>;
  meta: ReadonlyMap<string, StatsPlayerMeta>;
}

/**
 * Ab wie vielen Einsätzen ein Schnitt überhaupt etwas aussagt.
 *
 * Ohne Schranke gewinnt die Ø-Wertung jedes Mal der Spieler mit genau einem
 * starken Spieltag — eine Bestenliste, die nach dem zweiten Spieltag jede
 * Woche jemand anderen an die Spitze stellt, beschreibt nichts.
 */
export const MIN_APPEARANCES_FOR_AVERAGE = 3;

/**
 * Rechnet Elf-Historie und Spieltagspunkte zu einer Zeile je Spieler zusammen.
 *
 * Ein Spieler ohne Eintrag in `pointsByPlayer` fällt RAUS statt mit 0 Punkten
 * dazustehen: sein `/performance`-Request läuft noch oder ist fehlgeschlagen,
 * und „0 Punkte" wäre an dieser Stelle eine Behauptung und keine Messung
 * (dieselbe Überlegung wie bei `CompetitionPlayer.totalPoints === null`). Der
 * Screen zeigt stattdessen an, wie viele Spieler noch fehlen.
 *
 * Ein Spieler, der aufgestellt war und an dem Spieltag keinen Eintrag hat, ist
 * dagegen ein normaler Nuller: aufgestellt, nicht gespielt, null Punkte —
 * der Einsatz zählt trotzdem, sonst sähe sein Schnitt besser aus als er war.
 */
export function buildPointSources({ lineups, pointsByPlayer, meta }: PointSourceInput): PointSource[] {
  const totals = new Map<string, { points: number; appearances: number }>();

  for (const lineup of lineups) {
    for (const playerId of lineup.playerIds) {
      const days = pointsByPlayer.get(playerId);
      if (!days) continue;
      const entry = totals.get(playerId) ?? { points: 0, appearances: 0 };
      entry.points += days.get(lineup.day) ?? 0;
      entry.appearances += 1;
      totals.set(playerId, entry);
    }
  }

  const sources: PointSource[] = [];
  for (const [playerId, { points, appearances }] of totals) {
    const info = meta.get(playerId);
    sources.push({
      playerId,
      name: info?.name || `Spieler ${playerId}`,
      teamId: info?.teamId ?? '',
      position: info?.position ?? 'MID',
      imageUrl: info?.imageUrl ?? null,
      points,
      appearances,
      averagePoints: appearances > 0 ? points / appearances : 0,
    });
  }

  return sources;
}

export type RankMode = 'total' | 'average';

/**
 * Bringt die Zeilen in die Reihenfolge, in der der Screen sie zeigt.
 *
 * `average` filtert zusätzlich (siehe MIN_APPEARANCES_FOR_AVERAGE) — das ist
 * der Grund, warum Sortierung und Filter hier zusammen stehen und nicht an
 * zwei Stellen im Screen.
 *
 * Der Name als letztes Kriterium ist kein Schönheitsfehler: bei
 * Punktgleichheit wäre die Reihenfolge sonst die zufällige Einfügereihenfolge
 * der Map und würde bei jedem Neuladen springen.
 */
export function rankPointSources(sources: readonly PointSource[], mode: RankMode): PointSource[] {
  const rows = mode === 'average'
    ? sources.filter((source) => source.appearances >= MIN_APPEARANCES_FOR_AVERAGE)
    : [...sources];

  return rows.sort((a, b) => {
    const primary = mode === 'average' ? b.averagePoints - a.averagePoints : b.points - a.points;
    if (primary !== 0) return primary;
    if (b.appearances !== a.appearances) return b.appearances - a.appearances;
    return a.name.localeCompare(b.name, 'de-DE');
  });
}

/** Eine zusammengefasste Zeile: ein Verein oder eine Position statt eines Spielers. */
export interface StatsGroup {
  key: string;
  label: string;
  points: number;
  appearances: number;
  /** Wie viele verschiedene Spieler zu dieser Gruppe beigetragen haben. */
  playerCount: number;
  averagePoints: number;
}

function groupBy(
  sources: readonly PointSource[],
  keyOf: (source: PointSource) => string,
  labelOf: (key: string) => string,
): StatsGroup[] {
  const groups = new Map<string, { points: number; appearances: number; playerCount: number }>();

  for (const source of sources) {
    const key = keyOf(source);
    const group = groups.get(key) ?? { points: 0, appearances: 0, playerCount: 0 };
    group.points += source.points;
    group.appearances += source.appearances;
    group.playerCount += 1;
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: labelOf(key),
      ...group,
      averagePoints: group.appearances > 0 ? group.points / group.appearances : 0,
    }))
    .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label, 'de-DE'));
}

/**
 * „Die meisten Punkte kamen von Spielern des BVB" — dieselbe Rechnung wie
 * oben, nur über den Verein summiert. Vereinsnamen kommen aus
 * `/v4/competitions/{id}/table` (useCompetitionTeams), der einzigen Quelle
 * dafür; ein unbekannter Verein behält seine ID als Label, statt die Zeile zu
 * schlucken.
 */
export function groupByTeam(
  sources: readonly PointSource[],
  teamNames: ReadonlyMap<string, string>,
): StatsGroup[] {
  return groupBy(
    sources,
    (source) => source.teamId,
    (teamId) => teamNames.get(teamId) || (teamId ? `Verein ${teamId}` : 'Unbekannter Verein'),
  );
}

export function groupByPosition(sources: readonly PointSource[]): StatsGroup[] {
  return groupBy(
    sources,
    (source) => source.position,
    (position) => positionLabels[position as Position] ?? position,
  );
}

/** Summe aller erfassten Punkte — Gegenprobe zu den Saisonpunkten der Liga-Tabelle. */
export function totalPoints(sources: readonly PointSource[]): number {
  return sources.reduce((sum, source) => sum + source.points, 0);
}
