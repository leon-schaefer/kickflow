import type { PlayerStatus, Position } from '@/api/kickbase';
import { AVAILABLE_FORMATIONS, requiredCountsForFormation } from './formations';

/**
 * Bewertet Formationen/Startelf nach zwei Zielfunktionen. Positionen sind
 * unabhängig und es gibt keine Budget-Nebenbedingung — die optimale Elf für
 * eine Formation ist deshalb schlicht "die besten N je Position", kein
 * Rucksackproblem. Jede Positionsgruppe wird einmal sortiert und per
 * Präfixsumme ausgewertet, alle Formationen laufen danach in O(1).
 *
 * Wichtiger Vorbehalt: die Summe über die Elf ist zwischen Formationen
 * vergleichbar, weil jede Formation exakt 11 Slots hat — aber ein Vergleich
 * von z. B. 5-4-1 gegen 3-4-3 auf Punkte/Mio ist keine taktische Aussage. Er
 * belohnt die Positionsgruppe, in der zufällig die günstigen Effizienzspieler
 * stecken. Die Elf maximiert die gewählte Metrik, nicht "die beste Fußball-
 * Aufstellung".
 */

/**
 * 'valuePerMillion' = Ø-Punkte/Mio (Effizienz), 'points' = Ø-Punkte (Rohertrag),
 * 'expectedPoints' = Ø-Punkte gewichtet mit der Gegner-Härte der nächsten
 * Spiele (siehe src/utils/fixtureDifficulty.ts) — ein grober, transparent
 * kommunizierter Faktor um 1,0, kein kalibriertes Vorhersagemodell.
 */
export type OptimizerMetric = 'valuePerMillion' | 'points' | 'expectedPoints';

/**
 * Minimale Feldmenge, die der Optimizer braucht — SquadPlayer erfüllt sie
 * strukturell (Vorbild: MetricPlayer in src/utils/playerMetric.ts).
 * `expectedPoints` ist optional: nur useLineupOptimizer() reichert Spieler
 * damit an (wenn ein Spielplan vorliegt); ohne den Wert fällt die Metrik
 * `'expectedPoints'` auf `averagePoints` zurück, verhält sich also wie 'points'.
 */
export interface OptimizerPlayer {
  id: string;
  position: Position;
  status: PlayerStatus;
  teamId: string;
  marketValue: number;
  averagePoints: number;
  valueScoreAvg: number;
  expectedPoints?: number;
}

export interface FormationResult {
  formation: string;
  feasible: boolean;
  /** Summe der Metrik über die gewählte Elf; null, wenn nicht besetzbar. */
  score: number | null;
  /** score / playerIds.length — nur für die Anzeige, das Ranking bleibt identisch. */
  scoreAverage: number | null;
  /** Gewählte IDs in Reihenfolge GK, DEF, MID, FWD. Leer, wenn nicht besetzbar. */
  playerIds: string[];
  /** Fehlende Spieler je Position. Leer, wenn besetzbar. */
  missing: Partial<Record<Position, number>>;
  /**
   * IDs aktiver Liga-Regeln (src/lineup/rules.ts), die GENAU diese Formation
   * blockieren — leer, wenn besetzbar oder wegen `missing` unbesetzbar. Immer
   * leer bei diesem Modul selbst (`optimizeLineup` kennt keine Regeln); nur
   * `optimizeLineupWithRules` in constrainedLineup.ts befüllt das Feld.
   */
  blockedByRuleIds: string[];
}

export interface OptimizationResult {
  metric: OptimizerMetric;
  /** Alle geprüften Formationen: besetzbare absteigend nach score, nicht besetzbare am Ende. */
  ranking: FormationResult[];
  /** Beste besetzbare Formation, oder null, wenn keine besetzbar ist. */
  best: FormationResult | null;
  /** Wegen Status (verletzt/gesperrt/...) gar nicht erst berücksichtigt. */
  excludedPlayerIds: string[];
  /** Union aller IDs, die in irgendeiner besetzbaren Formation starten würden. */
  usedInAnyFormation: Set<string>;
  /** Aktive Regeln, die verhindern, dass überhaupt eine Formation besetzbar ist. Siehe FormationResult.blockedByRuleIds. */
  blockedRuleIds: string[];
}

const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

/**
 * Vollständige Map statt Set/Array — sobald PlayerStatus einen neuen Wert
 * bekommt, bricht der Build hier, statt still "verfügbar" anzunehmen.
 * mapStatus() liefert heute nur fit/injured/unknown, die übrigen sind
 * vorsorglich abgedeckt.
 */
const AVAILABILITY: Record<PlayerStatus, boolean> = {
  fit: true,
  doubtful: true,
  unknown: true,
  injured: false,
  rehab: false,
  suspended: false,
  away: false,
};

export function isAvailableForLineup(status: PlayerStatus): boolean {
  return AVAILABILITY[status];
}

export function metricValue(player: OptimizerPlayer, metric: OptimizerMetric): number {
  switch (metric) {
    case 'valuePerMillion':
      return player.valueScoreAvg;
    case 'expectedPoints':
      return player.expectedPoints ?? player.averagePoints;
    case 'points':
      return player.averagePoints;
  }
}

/** "Die jeweils andere Metrik" fürs Tie-Break — 'expectedPoints' ist punkteartig, tie-breakt also wie 'points' auf die Effizienz. */
function otherMetricValue(player: OptimizerPlayer, metric: OptimizerMetric): number {
  return metric === 'valuePerMillion' ? player.averagePoints : player.valueScoreAvg;
}

/**
 * Sortiert eine Positionsgruppe absteigend nach der Zielmetrik. Drei
 * Vergleichsschlüssel, der letzte total (id), damit gleiche Metrikwerte nie
 * eine instabile Ausgabe erzeugen — unabhängig von Sort-Stabilität oder
 * Eingabereihenfolge:
 *   1. Primärmetrik absteigend
 *   2. die jeweils andere Metrik absteigend (bei Gleichstand: bei Effizienz
 *      gewinnt der absolut stärkere Spieler, bei Punkten der günstigere)
 *   3. id aufsteigend
 *
 * Exportiert, damit lineup.tsx beim manuellen Formationswechsel (changeFormation)
 * dieselbe Rangfolge verwendet wie optimizeLineup — sonst könnten die beiden
 * Codepfade bei Gleichstand unterschiedliche Spieler auswählen.
 */
export function compareByMetric(metric: OptimizerMetric) {
  return (a: OptimizerPlayer, b: OptimizerPlayer): number => {
    const primary = metricValue(b, metric) - metricValue(a, metric);
    if (primary !== 0) return primary;
    const secondary = otherMetricValue(b, metric) - otherMetricValue(a, metric);
    if (secondary !== 0) return secondary;
    return a.id.localeCompare(b.id);
  };
}

/** Präfixsummen der Metrik über eine sortierte Gruppe; prefix[0] = 0. */
function prefixSums(sorted: OptimizerPlayer[], metric: OptimizerMetric): number[] {
  const prefix = [0];
  for (const player of sorted) {
    prefix.push(prefix[prefix.length - 1]! + metricValue(player, metric));
  }
  return prefix;
}

export function optimizeLineup(
  players: readonly OptimizerPlayer[],
  metric: OptimizerMetric,
  formations: readonly string[] = AVAILABLE_FORMATIONS,
): OptimizationResult {
  const byPosition: Record<Position, OptimizerPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  const excludedPlayerIds: string[] = [];

  for (const player of players) {
    if (isAvailableForLineup(player.status)) {
      byPosition[player.position].push(player);
    } else {
      excludedPlayerIds.push(player.id);
    }
  }

  const comparator = compareByMetric(metric);
  const sortedByPosition: Record<Position, OptimizerPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  const prefixByPosition: Record<Position, number[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const position of POSITIONS) {
    const sorted = [...byPosition[position]].sort(comparator);
    sortedByPosition[position] = sorted;
    prefixByPosition[position] = prefixSums(sorted, metric);
  }

  const ranking: FormationResult[] = formations.map((formation) => {
    const required = requiredCountsForFormation(formation);
    const requiredTotal = required.GK + required.DEF + required.MID + required.FWD;
    // requiredCountsForFormation degradiert bei unparsbarem Input auf {GK:1,...:0}
    // (Summe 1) statt 11 — kann mit den 8 AVAILABLE_FORMATIONS nicht auftreten,
    // schützt aber davor, dass ein fehlerhafter Formationsstring in einer
    // benutzerdefinierten `formations`-Liste eine kurze "Optimalelf" erzeugt.
    if (requiredTotal !== 11) {
      return { formation, feasible: false, score: null, scoreAverage: null, playerIds: [], missing: {}, blockedByRuleIds: [] };
    }

    const missing: Partial<Record<Position, number>> = {};
    for (const position of POSITIONS) {
      const shortfall = required[position] - sortedByPosition[position].length;
      if (shortfall > 0) missing[position] = shortfall;
    }

    if (Object.keys(missing).length > 0) {
      return { formation, feasible: false, score: null, scoreAverage: null, playerIds: [], missing, blockedByRuleIds: [] };
    }

    let score = 0;
    const playerIds: string[] = [];
    for (const position of POSITIONS) {
      const count = required[position];
      score += prefixByPosition[position][count]!;
      playerIds.push(...sortedByPosition[position].slice(0, count).map((p) => p.id));
    }

    return {
      formation,
      feasible: true,
      score,
      scoreAverage: playerIds.length > 0 ? score / playerIds.length : null,
      playerIds,
      missing: {},
      blockedByRuleIds: [],
    };
  });

  ranking.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    if (a.feasible && b.feasible) {
      if (b.score! !== a.score!) return b.score! - a.score!;
    }
    return formations.indexOf(a.formation) - formations.indexOf(b.formation);
  });

  const best = ranking[0]?.feasible ? ranking[0]! : null;

  const usedInAnyFormation = new Set<string>();
  for (const result of ranking) {
    if (result.feasible) {
      for (const id of result.playerIds) usedInAnyFormation.add(id);
    }
  }

  return { metric, ranking, best, excludedPlayerIds, usedInAnyFormation, blockedRuleIds: [] };
}

/**
 * Fehlende Spieler je Position für eine Formation, unabhängig von Liga-Regeln
 * — nur die Verfügbarkeit (Status) zählt. Eigenständig neben der internen
 * `missing`-Berechnung oben (die dort bewusst unverändert bleibt), damit
 * constrainedLineup.ts dieselbe "reicht die Kader-Größe je Position"-Prüfung
 * verwenden kann, bevor es eine Regel für eine Blockade verantwortlich macht.
 */
export function missingForFormation(
  players: readonly OptimizerPlayer[],
  formation: string,
): Partial<Record<Position, number>> {
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const player of players) {
    if (isAvailableForLineup(player.status)) counts[player.position]++;
  }
  const required = requiredCountsForFormation(formation);
  const missing: Partial<Record<Position, number>> = {};
  for (const position of POSITIONS) {
    const shortfall = required[position] - counts[position];
    if (shortfall > 0) missing[position] = shortfall;
  }
  return missing;
}
