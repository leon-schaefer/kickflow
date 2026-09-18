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
 *
 * AUFFÜLLEN MIT AUSFÄLLEN: Reichen die einsatzfähigen Spieler einer Position
 * für eine Formation nicht, füllen nicht einsatzfähige (verletzt, gesperrt,
 * abwesend, Reha) die freien Plätze — statt dass die Formation unbesetzbar
 * wird und im Extremfall (einziger Torwart verletzt) gar keine Elf mehr
 * vorgeschlagen werden kann. Drei Regeln, alle in `optimizeLineup`,
 * `constrainedLineup.ts` und `cappedLineup.ts` gleich:
 *
 * 1. Ein Auffüller zählt 0 zur Metrik. Er spielt nicht, also bringt er
 *    nichts — auch keine negativen Punkte, und auch nicht seine eigenen
 *    Ø-Punkte, die ihn sonst zur Elf-Verstärkung machen würden.
 * 2. Ein Auffüller kommt NUR auf einen Platz, für den kein einsatzfähiger
 *    Spieler mehr da ist — je Position stehen erst alle Einsatzfähigen, dann
 *    die Ausfälle (siehe `compareForSlot`). Ein fitter Spieler mit negativem
 *    Schnitt bleibt also trotzdem vor dem Ausfall, obwohl 0 > negativ: der
 *    Optimizer stellt nie freiwillig jemanden auf, der nicht spielen kann.
 * 3. Zwischen Formationen gilt dasselbe als Stufe VOR der Metrik: weniger
 *    Auffüller schlagen immer mehr Auffüller (`fillerIds.length`), erst bei
 *    Gleichstand entscheidet der Score. Eine Formation ohne Ausfall wird
 *    dadurch nie von einer mit Ausfall verdrängt, selbst wenn deren zehn
 *    Einsatzfähige mehr Punkte summieren — sonst stünde plötzlich ein
 *    Verletzter auf dem Feld, obwohl elf Fitte da sind.
 *
 * `missing` bezeichnet seither das, was auch mit Auffüllern noch fehlt.
 */

/**
 * 'points' = Ø-Punkte (Rohertrag), 'expectedPoints' = Ø-Punkte gewichtet mit
 * der Gegner-Härte der nächsten Spiele (siehe src/utils/fixtureDifficulty.ts)
 * — ein grober, transparent kommunizierter Faktor um 1,0, kein kalibriertes
 * Vorhersagemodell —, 'valuePerMillion' = Ø-Punkte/Mio (Effizienz).
 *
 * Rangfolge der Werte, absichtlich in dieser Reihenfolge (die Voreinstellung
 * ist 'points', siehe useLineupOptimizer.ts):
 *
 * 1. PUNKTE sind die Zielfunktion. Am Spieltag zählt die Summe über die Elf,
 *    nicht die Effizienz, mit der sie zustande kam. Eine Elf aufzustellen
 *    kostet nichts — der Kader ist gekauft, das Budget ist bereits ausgegeben.
 * 2. EFFIZIENZ ist ein Transfer-Signal, kein Aufstellungsziel. Ø-Punkte/Mio
 *    beantwortet "wen kaufe/verkaufe ich", nicht "wen stelle ich auf". Ein
 *    Optimierer, der die Summe der Quotienten maximiert, maximiert eine Größe,
 *    die kein Spieltag auszahlt: er lässt bewusst Punkte liegen, um teure
 *    Spieler zu meiden, deren Preis längst bezahlt ist. Deshalb speist die
 *    Metrik in sellAdvice.ts die Kaufen/Verkaufen-Liste, wo sie hingehört.
 * 3. GELD wird zur harten NEBENBEDINGUNG, nie zum Ziel. Ist das Konto im
 *    Minus, deckelt der Kontoausgleich (utils/sellPlan.ts) den Marktwert der
 *    behaltenen Elf und maximiert die Punkte DARUNTER (Pareto-DP in
 *    cappedLineup.ts, global optimal). Auch dort bleibt 'points' die richtige
 *    Zielfunktion — Ø-Punkte/Mio wäre für dieses Rucksackproblem nur die
 *    greedy Heuristik, die es exakt zu ersetzen gilt.
 *
 * Innerhalb einer Metrik ist die Effizienz das Tie-Break (siehe
 * compareByMetric): bei gleichen Ø-Punkten gewinnt der günstigere Spieler.
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
  /** Gewählte IDs in Reihenfolge GK, DEF, MID, FWD (je Position erst Einsatzfähige, dann Auffüller). Leer, wenn nicht besetzbar. */
  playerIds: string[];
  /**
   * Teilmenge von `playerIds`: nicht einsatzfähige Spieler, die einen Platz
   * füllen, für den kein einsatzfähiger mehr da war (siehe Modul-Doku). Sie
   * zählen 0 zum `score`. Leer, wenn die Elf komplett einsatzfähig ist.
   */
  fillerIds: string[];
  /** Fehlende Spieler je Position — auch mit Auffüllern. Leer, wenn besetzbar. */
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
  /** Alle geprüften Formationen: besetzbare zuerst (wenige Auffüller vor vielen, darin absteigend nach score), nicht besetzbare am Ende. */
  ranking: FormationResult[];
  /** Beste besetzbare Formation, oder null, wenn keine besetzbar ist. */
  best: FormationResult | null;
  /** Wegen Status (verletzt/gesperrt/...) nicht einsatzfähig — stehen höchstens als Auffüller in einer Elf (siehe Modul-Doku). */
  excludedPlayerIds: string[];
  /**
   * Union aller IDs, die in irgendeiner besetzbaren Formation der besten Stufe
   * starten würden — also mit so wenigen Auffüllern wie `best`. Formationen,
   * die mehr Ausfälle bräuchten, kommen nie zum Zug; ihre Spieler zählen hier
   * nicht als "irgendwo gebraucht" (Vorbild der Nutzung: utils/sellAdvice.ts).
   */
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

/**
 * Rangfolge für die Platzvergabe innerhalb einer Position: erst alle
 * Einsatzfähigen (nach `compareByMetric`), dann die Ausfälle (ebenfalls nach
 * `compareByMetric`, nur damit die Reihenfolge deterministisch ist — zum
 * Score tragen sie ohnehin 0 bei). Das ist Regel 2 der Modul-Doku: ein
 * Ausfall füllt nur einen Platz, für den kein Einsatzfähiger mehr übrig ist.
 *
 * Genutzt von `optimizeLineup` und von `orderIds` in constrainedLineup.ts,
 * damit `FormationResult.playerIds` auf beiden Pfaden gleich sortiert ist.
 */
export function compareForSlot(metric: OptimizerMetric) {
  const byMetric = compareByMetric(metric);
  return (a: OptimizerPlayer, b: OptimizerPlayer): number => {
    const aAvailable = isAvailableForLineup(a.status);
    const bAvailable = isAvailableForLineup(b.status);
    if (aAvailable !== bAvailable) return aAvailable ? -1 : 1;
    return byMetric(a, b);
  };
}

/** Metrikbeitrag eines Spielers zur Elf: 0 für einen Auffüller (Regel 1 der Modul-Doku), sonst `metricValue`. */
export function slotValue(player: OptimizerPlayer, metric: OptimizerMetric): number {
  return isAvailableForLineup(player.status) ? metricValue(player, metric) : 0;
}

/** Präfixsummen des Platzbeitrags über eine per `compareForSlot` sortierte Gruppe; prefix[0] = 0. */
function prefixSums(sorted: OptimizerPlayer[], metric: OptimizerMetric): number[] {
  const prefix = [0];
  for (const player of sorted) {
    prefix.push(prefix[prefix.length - 1]! + slotValue(player, metric));
  }
  return prefix;
}

/**
 * Ranking-Ordnung über Formationen (Regel 3 der Modul-Doku): besetzbare vor
 * unbesetzbaren; darunter wenige Auffüller vor vielen; darunter Score
 * absteigend; zuletzt die Reihenfolge in `formations` — bei Gleichstand
 * gewinnt also die frühere (siehe AVAILABLE_FORMATIONS). Gemeinsam mit
 * constrainedLineup.ts, damit beide Pfade identisch sortieren.
 */
export function compareFormationResults(formations: readonly string[]) {
  return (a: FormationResult, b: FormationResult): number => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    if (a.feasible && b.feasible) {
      if (a.fillerIds.length !== b.fillerIds.length) return a.fillerIds.length - b.fillerIds.length;
      if (b.score! !== a.score!) return b.score! - a.score!;
    }
    return formations.indexOf(a.formation) - formations.indexOf(b.formation);
  };
}

/** Siehe OptimizationResult.usedInAnyFormation — die Union über die besetzbaren Formationen der besten Stufe. */
export function usedInBestTier(ranking: readonly FormationResult[], best: FormationResult | null): Set<string> {
  const used = new Set<string>();
  if (!best) return used;
  for (const result of ranking) {
    if (result.feasible && result.fillerIds.length === best.fillerIds.length) {
      for (const id of result.playerIds) used.add(id);
    }
  }
  return used;
}

function infeasible(formation: string, missing: Partial<Record<Position, number>>): FormationResult {
  return { formation, feasible: false, score: null, scoreAverage: null, playerIds: [], fillerIds: [], missing, blockedByRuleIds: [] };
}

export function optimizeLineup(
  players: readonly OptimizerPlayer[],
  metric: OptimizerMetric,
  formations: readonly string[] = AVAILABLE_FORMATIONS,
): OptimizationResult {
  const byPosition: Record<Position, OptimizerPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  const excludedPlayerIds: string[] = [];

  for (const player of players) {
    byPosition[player.position].push(player);
    if (!isAvailableForLineup(player.status)) excludedPlayerIds.push(player.id);
  }

  // Je Position: erst die Einsatzfähigen nach Metrik, dahinter die Ausfälle
  // (compareForSlot). Die "besten N" sind damit weiter ein Präfix — nur dass
  // das Präfix über die Einsatzfähigen hinaus in die Auffüller reichen darf.
  const comparator = compareForSlot(metric);
  const sortedByPosition: Record<Position, OptimizerPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  const availableByPosition: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  const prefixByPosition: Record<Position, number[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const position of POSITIONS) {
    const sorted = [...byPosition[position]].sort(comparator);
    sortedByPosition[position] = sorted;
    availableByPosition[position] = sorted.filter((p) => isAvailableForLineup(p.status)).length;
    prefixByPosition[position] = prefixSums(sorted, metric);
  }

  const ranking: FormationResult[] = formations.map((formation) => {
    const required = requiredCountsForFormation(formation);
    const requiredTotal = required.GK + required.DEF + required.MID + required.FWD;
    // requiredCountsForFormation degradiert bei unparsbarem Input auf {GK:1,...:0}
    // (Summe 1) statt 11 — kann mit den AVAILABLE_FORMATIONS nicht auftreten,
    // schützt aber davor, dass ein fehlerhafter Formationsstring in einer
    // benutzerdefinierten `formations`-Liste eine kurze "Optimalelf" erzeugt.
    if (requiredTotal !== 11) return infeasible(formation, {});

    const missing: Partial<Record<Position, number>> = {};
    for (const position of POSITIONS) {
      const shortfall = required[position] - sortedByPosition[position].length;
      if (shortfall > 0) missing[position] = shortfall;
    }
    if (Object.keys(missing).length > 0) return infeasible(formation, missing);

    let score = 0;
    const playerIds: string[] = [];
    const fillerIds: string[] = [];
    for (const position of POSITIONS) {
      const count = required[position];
      score += prefixByPosition[position][count]!;
      const chosen = sortedByPosition[position].slice(0, count);
      playerIds.push(...chosen.map((p) => p.id));
      // Alles jenseits der Einsatzfähigen ist per Sortierung ein Auffüller.
      fillerIds.push(...chosen.slice(availableByPosition[position]).map((p) => p.id));
    }

    return {
      formation,
      feasible: true,
      score,
      scoreAverage: playerIds.length > 0 ? score / playerIds.length : null,
      playerIds,
      fillerIds,
      missing: {},
      blockedByRuleIds: [],
    };
  });

  ranking.sort(compareFormationResults(formations));

  const best = ranking[0]?.feasible ? ranking[0]! : null;

  return { metric, ranking, best, excludedPlayerIds, usedInAnyFormation: usedInBestTier(ranking, best), blockedRuleIds: [] };
}

/**
 * Fehlende Spieler je Position für eine Formation, unabhängig von Liga-Regeln
 * — nur die Kadergröße je Position zählt, Ausfälle eingeschlossen (sie füllen
 * auf, siehe Modul-Doku). Eigenständig neben der internen `missing`-Berechnung
 * oben (die dort bewusst unverändert bleibt), damit constrainedLineup.ts
 * dieselbe "reicht die Kader-Größe je Position"-Prüfung verwenden kann, bevor
 * es eine Regel für eine Blockade verantwortlich macht.
 */
export function missingForFormation(
  players: readonly OptimizerPlayer[],
  formation: string,
): Partial<Record<Position, number>> {
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const player of players) counts[player.position]++;
  const required = requiredCountsForFormation(formation);
  const missing: Partial<Record<Position, number>> = {};
  for (const position of POSITIONS) {
    const shortfall = required[position] - counts[position];
    if (shortfall > 0) missing[position] = shortfall;
  }
  return missing;
}
