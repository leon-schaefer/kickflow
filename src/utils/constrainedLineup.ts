import type { Position } from '@/api/kickbase';
import {
  constrainingRuleIds,
  isUnconstrained,
  UNCONSTRAINED_CONSTRAINTS,
  type LineupConstraints,
} from '@/lineup/rules';
import {
  bestLineupUnderValueCap,
  bestUnderCap,
  buildPositionFronts,
  byFormationOrder,
  cheapestLineup,
  compareQuality,
  EMPTY_POINT,
  pruneFront,
  type CappedPick,
  type FrontPoint,
} from './cappedLineup';
import { AVAILABLE_FORMATIONS, requiredCountsForFormation } from './formations';
import {
  compareForSlot,
  compareFormationResults,
  isAvailableForLineup,
  missingForFormation,
  optimizeLineup,
  usedInBestTier,
  type FormationResult,
  type OptimizationResult,
  type OptimizerMetric,
  type OptimizerPlayer,
} from './lineupOptimizer';

/**
 * Erweitert optimizeLineup/bestLineupUnderValueCap/cheapestLineup um eine
 * Vereins-Obergrenze (LineupConstraints.maxPerTeam, siehe src/lineup/rules.ts).
 *
 * Grund für ein eigenes Modul statt eines Parameters an Ort und Stelle: beide
 * bestehenden Optimierer setzen voraus, dass die vier Positionsgruppen
 * UNABHÄNGIG sind (siehe Modul-Doku in lineupOptimizer.ts/cappedLineup.ts).
 * Eine Vereins-Obergrenze koppelt sie — ein Bayern-Verteidiger verdrängt
 * einen Bayern-Stürmer. Das macht beide Verfahren ungültig, nicht nur
 * ungenau, und braucht ein eigenes exaktes Verfahren.
 *
 * Kernidee: die Vereins-Obergrenze ist LOKAL — sobald ein Verein
 * abgearbeitet ist, ist irrelevant, WELCHE seiner Spieler gewählt wurden, nur
 * WIE VIELE je Position. Der DP-Zustand ist deshalb ein reiner
 * Positionszähler (g,d,m,f), nicht "welche Spieler sind schon vergeben" — ein
 * klassisches gruppiertes Rucksackproblem, Vereine sind die Gruppen.
 *
 * Je Verein wird zunächst dessen eigener Beitrag für jede mögliche
 * (g,d,m,f)-Kombination bis zur Vereins-Obergrenze berechnet (Kreuzprodukt
 * der vier Positions-Pareto-Fronten aus cappedLineup.buildPositionFronts,
 * wiederverwendet — innerhalb eines Vereins konkurrieren Positionen nicht
 * um denselben Slot). Anschließend werden die Vereine nacheinander in eine
 * globale DP über denselben Zustandsraum gefaltet. Da das eine vollständige
 * Rucksack-Faltung ist, ist das Ergebnis unabhängig von der Verarbeitungs-
 * reihenfolge der Vereine — nur die abschließende Pareto-Prune-Reihenfolge
 * entscheidet bei exaktem Gleichstand (idKey, wie in cappedLineup.ts).
 *
 * Zwei Modi, weil die Zielfunktion unterschiedlich teuer ist:
 * - 'score': nur der beste Punkt je Zustand (Front der Größe ≤1) — für
 *   optimizeLineupWithRules, das keinen Marktwert-Cap kennt.
 * - 'pareto': die volle Pareto-Front — für bestLineupUnderValueCapWithRules
 *   und cheapestLineupWithRules (Verkaufsplan-Pfad).
 * "Bester" heißt in beiden Modi `compareQuality` aus cappedLineup.ts: erst
 * wenige Auffüller, dann Score. Nicht einsatzfähige Spieler laufen als Items
 * mit Beitrag 0 durch die DP und zählen dabei ganz normal gegen die
 * Vereins-Obergrenze — ein verletzter Bayern-Spieler auf dem Feld ist für
 * die Regel ein Bayern-Spieler (siehe Modul-Doku in lineupOptimizer.ts).
 *
 * Ohne aktive Regeln (`isUnconstrained`) delegieren alle drei Wrapper direkt
 * an die bestehenden, ungekoppelten Verfahren — der heute genutzte, seit
 * Commit b9c722b getestete Pfad bleibt unverändert in Betrieb.
 */

const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];
const EMPTY_FRONT: FrontPoint[] = [EMPTY_POINT];

type FrontReducer = (points: readonly FrontPoint[]) => FrontPoint[];

function idKey(ids: readonly string[]): string {
  return [...ids].sort().join(',');
}

/** score-Modus: nur der beste Punkt (compareQuality), Marktwert spielt keine Rolle für die Auswahl. */
function keepBestScore(points: readonly FrontPoint[]): FrontPoint[] {
  let best: FrontPoint | null = null;
  for (const point of points) {
    if (!best) {
      best = point;
      continue;
    }
    const quality = compareQuality(point, best);
    if (quality < 0 || (quality === 0 && idKey(point.ids) < idKey(best.ids))) best = point;
  }
  return best ? [best] : [];
}

function maxRequired(formations: readonly string[], position: Position): number {
  return Math.max(0, ...formations.map((f) => requiredCountsForFormation(f)[position]));
}

function combineFronts(a: readonly FrontPoint[], b: readonly FrontPoint[], reduce: FrontReducer): FrontPoint[] {
  if (a.length === 0 || b.length === 0) return [];
  const combined: FrontPoint[] = [];
  for (const pa of a) {
    for (const pb of b) {
      combined.push({
        marketValue: pa.marketValue + pb.marketValue,
        score: pa.score + pb.score,
        fillers: pa.fillers + pb.fillers,
        ids: [...pa.ids, ...pb.ids],
      });
    }
  }
  return reduce(combined);
}

interface StateKey {
  g: number;
  d: number;
  m: number;
  f: number;
}

function key(s: StateKey): string {
  return `${s.g}|${s.d}|${s.m}|${s.f}`;
}

/** Front für "genau g/d/m/f Spieler dieses Vereins" durch Kreuzung der vier Positions-Fronten (bereits einzeln gebaut). */
function frontForCombo(positionFronts: Record<Position, FrontPoint[][]>, combo: StateKey, reduce: FrontReducer): FrontPoint[] {
  const counts: Record<Position, number> = { GK: combo.g, DEF: combo.d, MID: combo.m, FWD: combo.f };
  let combined: FrontPoint[] = EMPTY_FRONT;
  for (const position of POSITIONS) {
    const positionFront = positionFronts[position][counts[position]];
    if (!positionFront) return [];
    combined = combineFronts(combined, positionFront, reduce);
    if (combined.length === 0) return [];
  }
  return combined;
}

/**
 * Baut je Formation die kombinierte Front unter der Vereins-Obergrenze. Nur
 * für den Fall aktiver Constraints gedacht — der Aufrufer prüft `isUnconstrained`.
 */
export function buildConstrainedFormationFronts(
  players: readonly OptimizerPlayer[],
  metric: OptimizerMetric,
  formations: readonly string[],
  constraints: LineupConstraints,
  mode: 'score' | 'pareto',
): { formation: string; front: FrontPoint[] }[] {
  const reduce: FrontReducer = mode === 'score' ? keepBestScore : pruneFront;
  const maxByPosition: Record<Position, number> = {
    GK: 1,
    DEF: maxRequired(formations, 'DEF'),
    MID: maxRequired(formations, 'MID'),
    FWD: maxRequired(formations, 'FWD'),
  };

  // Ausfälle bleiben im Pool — als Auffüller mit Beitrag 0 (siehe Modul-Doku).
  const byTeam = new Map<string, OptimizerPlayer[]>();
  for (const player of players) {
    const list = byTeam.get(player.teamId);
    if (list) list.push(player);
    else byTeam.set(player.teamId, [player]);
  }

  let dp = new Map<string, { state: StateKey; front: FrontPoint[] }>();
  const start: StateKey = { g: 0, d: 0, m: 0, f: 0 };
  dp.set(key(start), { state: start, front: EMPTY_FRONT });

  for (const teamPlayers of byTeam.values()) {
    const byPosition: Record<Position, OptimizerPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const player of teamPlayers) byPosition[player.position].push(player);

    // Team-lokale Fronten je Position, begrenzt durch die Vereins-Obergrenze
    // (mehr als das kann dieser Verein ohnehin nie beitragen) und die
    // formationsweite Obergrenze je Position.
    const positionFronts: Record<Position, FrontPoint[][]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const position of POSITIONS) {
      const maxCount = Math.min(byPosition[position].length, maxByPosition[position], constraints.maxPerTeam);
      positionFronts[position] = buildPositionFronts(byPosition[position], metric, maxCount);
    }

    // Alle Team-Beiträge (g,d,m,f) mit g+d+m+f <= Vereins-Obergrenze.
    const contributions: { combo: StateKey; front: FrontPoint[] }[] = [];
    const maxG = positionFronts.GK.length - 1;
    const maxD = positionFronts.DEF.length - 1;
    const maxM = positionFronts.MID.length - 1;
    const maxF = positionFronts.FWD.length - 1;
    for (let g = 0; g <= maxG; g++) {
      for (let d = 0; d <= maxD; d++) {
        for (let m = 0; m <= maxM; m++) {
          for (let f = 0; f <= maxF; f++) {
            if (g + d + m + f > constraints.maxPerTeam) continue;
            const combo: StateKey = { g, d, m, f };
            contributions.push({ combo, front: frontForCombo(positionFronts, combo, reduce) });
          }
        }
      }
    }

    const nextDp = new Map<string, { state: StateKey; front: FrontPoint[] }>();
    for (const { state, front: baseFront } of dp.values()) {
      for (const { combo, front: contributionFront } of contributions) {
        const next: StateKey = {
          g: state.g + combo.g,
          d: state.d + combo.d,
          m: state.m + combo.m,
          f: state.f + combo.f,
        };
        if (next.g > maxByPosition.GK || next.d > maxByPosition.DEF || next.m > maxByPosition.MID || next.f > maxByPosition.FWD) {
          continue;
        }
        const combined = combineFronts(baseFront, contributionFront, reduce);
        if (combined.length === 0) continue;
        const nextKey = key(next);
        const existing = nextDp.get(nextKey);
        const merged = reduce(existing ? [...existing.front, ...combined] : combined);
        nextDp.set(nextKey, { state: next, front: merged });
      }
    }
    dp = nextDp;
  }

  return formations.map((formation) => {
    const required = requiredCountsForFormation(formation);
    const requiredTotal = required.GK + required.DEF + required.MID + required.FWD;
    if (requiredTotal !== 11) return { formation, front: [] };
    const entry = dp.get(key({ g: required.GK, d: required.DEF, m: required.MID, f: required.FWD }));
    return { formation, front: entry?.front ?? [] };
  });
}

/** Ordnet gewählte IDs wie FormationResult.playerIds vertraglich zugesichert: GK, DEF, MID, FWD, je sortiert nach compareForSlot. */
function orderIds(ids: readonly string[], playersById: Map<string, OptimizerPlayer>, metric: OptimizerMetric): string[] {
  const byPosition: Record<Position, OptimizerPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const id of ids) {
    const player = playersById.get(id);
    if (player) byPosition[player.position].push(player);
  }
  const comparator = compareForSlot(metric);
  const ordered: string[] = [];
  for (const position of POSITIONS) {
    ordered.push(...[...byPosition[position]].sort(comparator).map((p) => p.id));
  }
  return ordered;
}

/**
 * Regeln, deren Wegfall die Elf wieder möglich machen würde. Mit aktuell nur
 * einer Regeldimension (maxPerTeam) ist das eindeutig: `optimizeLineupWithRules`
 * verzweigt hierher nur, wenn für mindestens eine Formation `missing` bereits
 * leer ist (Positionen reichen), die Front unter der Regel aber trotzdem leer
 * bleibt — die einzige aktive Regel ist dann zwangsläufig der Blocker. Bei
 * mehreren Regeldimensionen müsste hier je Regel einzeln relaxiert und neu
 * gelöst werden (siehe Plan "Später möglich").
 */
function diagnoseBlockers(constraints: LineupConstraints): string[] {
  return constrainingRuleIds(constraints);
}

/** optimizeLineup + Vereins-Obergrenze. Ohne aktive Regeln identisch zu optimizeLineup. */
export function optimizeLineupWithRules(
  players: readonly OptimizerPlayer[],
  metric: OptimizerMetric,
  formations: readonly string[] = AVAILABLE_FORMATIONS,
  constraints: LineupConstraints = UNCONSTRAINED_CONSTRAINTS,
): OptimizationResult {
  if (isUnconstrained(constraints)) return optimizeLineup(players, metric, formations);

  const fronts = buildConstrainedFormationFronts(players, metric, formations, constraints, 'score');
  const frontByFormation = new Map(fronts.map((f) => [f.formation, f.front]));
  const playersById = new Map(players.map((p) => [p.id, p]));

  let ruleBlockedSomewhere = false;

  const infeasible = (formation: string, missing: Partial<Record<Position, number>>): FormationResult => ({
    formation,
    feasible: false,
    score: null,
    scoreAverage: null,
    playerIds: [],
    fillerIds: [],
    missing,
    blockedByRuleIds: [],
  });

  const ranking: FormationResult[] = formations.map((formation) => {
    const required = requiredCountsForFormation(formation);
    const requiredTotal = required.GK + required.DEF + required.MID + required.FWD;
    if (requiredTotal !== 11) return infeasible(formation, {});
    const missing = missingForFormation(players, formation);
    if (Object.keys(missing).length > 0) return infeasible(formation, missing);
    const point = frontByFormation.get(formation)?.[0];
    if (!point) {
      ruleBlockedSomewhere = true;
      return infeasible(formation, {});
    }
    const playerIds = orderIds(point.ids, playersById, metric);
    return {
      formation,
      feasible: true,
      score: point.score,
      scoreAverage: playerIds.length > 0 ? point.score / playerIds.length : null,
      playerIds,
      fillerIds: playerIds.filter((id) => !isAvailableForLineup(playersById.get(id)!.status)),
      missing: {},
      blockedByRuleIds: [],
    };
  });

  const blockedRuleIds = ruleBlockedSomewhere ? diagnoseBlockers(constraints) : [];
  if (blockedRuleIds.length > 0) {
    for (const entry of ranking) {
      if (!entry.feasible && Object.keys(entry.missing).length === 0) entry.blockedByRuleIds = blockedRuleIds;
    }
  }

  ranking.sort(compareFormationResults(formations));

  const best = ranking[0]?.feasible ? ranking[0]! : null;
  const excludedPlayerIds = players.filter((p) => !isAvailableForLineup(p.status)).map((p) => p.id);

  return { metric, ranking, best, excludedPlayerIds, usedInAnyFormation: usedInBestTier(ranking, best), blockedRuleIds };
}

/** bestLineupUnderValueCap + Vereins-Obergrenze. Ohne aktive Regeln identisch zu bestLineupUnderValueCap. */
export function bestLineupUnderValueCapWithRules(
  players: readonly OptimizerPlayer[],
  metric: OptimizerMetric,
  formations: readonly string[],
  cap: number,
  constraints: LineupConstraints = UNCONSTRAINED_CONSTRAINTS,
): CappedPick | null {
  if (isUnconstrained(constraints)) return bestLineupUnderValueCap(players, metric, formations, cap);

  const playersById = new Map(players.map((p) => [p.id, p]));
  const candidates = buildConstrainedFormationFronts(players, metric, formations, constraints, 'pareto')
    .map(({ formation, front }) => {
      const point = bestUnderCap(front, cap);
      return point && { formation, point };
    })
    .filter((c): c is { formation: string; point: FrontPoint } => Boolean(c));
  if (candidates.length === 0) return null;

  const winner = [...candidates].sort((a, b) => {
    return compareQuality(a.point, b.point) || byFormationOrder(formations)(a, b);
  })[0]!;
  return {
    formation: winner.formation,
    playerIds: orderIds(winner.point.ids, playersById, metric),
    score: winner.point.score,
    marketValue: winner.point.marketValue,
  };
}

/** cheapestLineup + Vereins-Obergrenze. Ohne aktive Regeln identisch zu cheapestLineup. */
export function cheapestLineupWithRules(
  players: readonly OptimizerPlayer[],
  metric: OptimizerMetric,
  formations: readonly string[],
  constraints: LineupConstraints = UNCONSTRAINED_CONSTRAINTS,
): CappedPick | null {
  if (isUnconstrained(constraints)) return cheapestLineup(players, metric, formations);

  const playersById = new Map(players.map((p) => [p.id, p]));
  const candidates = buildConstrainedFormationFronts(players, metric, formations, constraints, 'pareto')
    .map(({ formation, front }) => (front.length > 0 ? { formation, point: front[0]! } : null))
    .filter((c): c is { formation: string; point: FrontPoint } => c !== null);
  if (candidates.length === 0) return null;

  const winner = [...candidates].sort((a, b) => {
    if (a.point.marketValue !== b.point.marketValue) return a.point.marketValue - b.point.marketValue;
    return compareQuality(a.point, b.point) || byFormationOrder(formations)(a, b);
  })[0]!;
  return {
    formation: winner.formation,
    playerIds: orderIds(winner.point.ids, playersById, metric),
    score: winner.point.score,
    marketValue: winner.point.marketValue,
  };
}
