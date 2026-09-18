import type { Position } from '@/api/kickbase';
import { requiredCountsForFormation } from './formations';
import { isAvailableForLineup, slotValue, type OptimizerMetric, type OptimizerPlayer } from './lineupOptimizer';

/**
 * Kern-Baustein für `buildSellPlan` (siehe sellPlan.ts): "welche Spieler
 * behalten wir" unter einer Marktwert-Obergrenze — die punktbeste besetzbare
 * Elf mit Gesamtmarktwert ≤ cap.
 *
 * Da Positionen unabhängig sind (siehe lineupOptimizer.ts), ist das je
 * Formation ein 0/1-Rucksackproblem pro Positionsgruppe, keine Interaktion
 * zwischen den Gruppen außer der gemeinsamen Wert-Obergrenze. Statt eines
 * einzelnen Zielwerts pro Anzahl k wird deshalb je Positionsgruppe und k die
 * volle Pareto-Front aus (Marktwert, Punktsumme) aufgebaut: ein Punkt bleibt
 * nur, wenn kein anderer bei gleichem-oder-kleinerem Marktwert eine
 * gleich-oder-bessere Punktzahl hat. Für jeden beliebigen Cap ist damit der
 * Eintrag mit dem größten Marktwert ≤ cap automatisch der bestmögliche — die
 * Front ist in beiden Dimensionen monoton steigend. Die vier Fronten einer
 * Formation werden per Kreuzprodukt kombiniert (erneut geprunt), die Fronten
 * selbst sind bei Kadergrößen von 15–26 Spielern winzig.
 *
 * Nicht einsatzfähige Spieler sind gewöhnliche Items der DP — mit ihrem
 * Marktwert (den bindet die Elf ja), aber Beitrag 0 zum Score und +1 auf
 * `fillers`. Die "Güte" eines Punkts ist damit zweistufig (`compareQuality`):
 * erst weniger Auffüller, dann mehr Score. Das ist exakt die Rangfolge aus
 * lineupOptimizer.ts (Modul-Doku dort, Regeln 1–3), nur als Ordnung auf
 * Punkten statt als Sortierung — eine Elf mit Ausfall gewinnt hier also
 * ausschließlich, wenn unter dem Cap keine ohne Ausfall zu haben ist.
 */

export interface CappedPick {
  formation: string;
  /** Kann Auffüller enthalten (siehe Modul-Doku) — wer, sagt `isAvailableForLineup` je ID. */
  playerIds: string[];
  score: number;
  marketValue: number;
}

const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

export interface FrontPoint {
  marketValue: number;
  /** Summe der Platzbeiträge — Auffüller zählen 0 (`slotValue`). */
  score: number;
  /** Anzahl nicht einsatzfähiger Spieler in `ids`. */
  fillers: number;
  ids: string[];
}

export const EMPTY_POINT: FrontPoint = { marketValue: 0, score: 0, fillers: 0, ids: [] };

/** Kanonischer Schlüssel für deterministische Tie-Breaks bei exakt gleicher (marketValue, Güte). */
function idKey(ids: readonly string[]): string {
  return [...ids].sort().join(',');
}

/**
 * Güte eines Punkts, unabhängig vom Marktwert: negativ, wenn `a` besser ist.
 * Weniger Auffüller schlagen mehr Auffüller, erst dann zählt der Score —
 * siehe Modul-Doku. Überall dort, wo die DP früher `score` verglich.
 */
export function compareQuality(a: FrontPoint, b: FrontPoint): number {
  if (a.fillers !== b.fillers) return a.fillers - b.fillers;
  return b.score - a.score;
}

/**
 * Reduziert eine Menge von Kombinationen auf die Pareto-Front: aufsteigend
 * nach marketValue, nur Einträge mit strikt höherer Güte als alle
 * günstigeren behalten. Bei exakt gleicher (marketValue, Güte) gewinnt der
 * kanonisch kleinere idKey — sonst könnte die Auswahl je nach
 * Verarbeitungsreihenfolge der DP variieren.
 */
export function pruneFront(points: readonly FrontPoint[]): FrontPoint[] {
  const byValue = new Map<number, FrontPoint>();
  for (const point of points) {
    const existing = byValue.get(point.marketValue);
    if (!existing) {
      byValue.set(point.marketValue, point);
      continue;
    }
    const quality = compareQuality(point, existing);
    if (quality < 0 || (quality === 0 && idKey(point.ids) < idKey(existing.ids))) {
      byValue.set(point.marketValue, point);
    }
  }
  const sorted = [...byValue.values()].sort((a, b) => a.marketValue - b.marketValue);
  const front: FrontPoint[] = [];
  let best: FrontPoint | null = null;
  for (const point of sorted) {
    if (!best || compareQuality(point, best) < 0) {
      front.push(point);
      best = point;
    }
  }
  return front;
}

/**
 * Pareto-Fronten je Anzahl gewählter Spieler (Index 0…maxCount) für eine
 * Positionsgruppe — Item-für-Item-Rucksack-DP. k läuft pro Spieler absteigend
 * (0/1-Knapsack-Reihenfolge: fronts[k-1] ist beim Verarbeiten von k noch der
 * Stand vor diesem Spieler), danach wird jede Stufe geprunt.
 */
export function buildPositionFronts(players: readonly OptimizerPlayer[], metric: OptimizerMetric, maxCount: number): FrontPoint[][] {
  const items = [...players].sort((a, b) => a.id.localeCompare(b.id));
  const fronts: FrontPoint[][] = Array.from({ length: maxCount + 1 }, () => []);
  fronts[0] = [EMPTY_POINT];

  for (const item of items) {
    const filler = isAvailableForLineup(item.status) ? 0 : 1;
    for (let k = maxCount; k >= 1; k--) {
      const base = fronts[k - 1]!;
      if (base.length === 0) continue;
      const extended = base.map((point) => ({
        marketValue: point.marketValue + item.marketValue,
        score: point.score + slotValue(item, metric),
        fillers: point.fillers + filler,
        ids: [...point.ids, item.id],
      }));
      fronts[k] = pruneFront([...fronts[k]!, ...extended]);
    }
  }

  return fronts;
}

/** Bestmöglicher Eintrag (höchste Güte, siehe compareQuality) einer wertaufsteigenden Front mit marketValue ≤ cap; null, wenn keiner passt. */
export function bestUnderCap(front: readonly FrontPoint[], cap: number): FrontPoint | null {
  let best: FrontPoint | null = null;
  for (const point of front) {
    if (point.marketValue > cap) break;
    best = point;
  }
  return best;
}

function maxRequired(formations: readonly string[], position: Position): number {
  return Math.max(0, ...formations.map((f) => requiredCountsForFormation(f)[position]));
}

interface FormationFront {
  formation: string;
  front: FrontPoint[];
}

/**
 * Kombinierte Pareto-Front je Formation über alle vier Positionen
 * (Kreuzprodukt der vier Positions-Fronten + erneutes Prunen). Eine
 * Formation, deren Positionsbedarf keine Gruppe decken kann, bekommt eine
 * leere Front (unbesetzbar) — analog zu `missing` in optimizeLineup.
 */
function buildFormationFronts(
  players: readonly OptimizerPlayer[],
  metric: OptimizerMetric,
  formations: readonly string[],
): FormationFront[] {
  // Ausfälle bleiben im Pool — als Auffüller mit Beitrag 0 (siehe Modul-Doku).
  const byPosition: Record<Position, OptimizerPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const player of players) byPosition[player.position].push(player);

  const frontsByPosition: Record<Position, FrontPoint[][]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const position of POSITIONS) {
    const maxCount = Math.min(byPosition[position].length, maxRequired(formations, position));
    frontsByPosition[position] = buildPositionFronts(byPosition[position], metric, maxCount);
  }

  return formations.map((formation) => {
    const required = requiredCountsForFormation(formation);
    const requiredTotal = required.GK + required.DEF + required.MID + required.FWD;
    if (requiredTotal !== 11) return { formation, front: [] };

    let combined: FrontPoint[] = [EMPTY_POINT];
    for (const position of POSITIONS) {
      const positionFront = frontsByPosition[position][required[position]];
      if (!positionFront || positionFront.length === 0) {
        combined = [];
        break;
      }
      const next: FrontPoint[] = [];
      for (const base of combined) {
        for (const add of positionFront) {
          next.push({
            marketValue: base.marketValue + add.marketValue,
            score: base.score + add.score,
            fillers: base.fillers + add.fillers,
            ids: [...base.ids, ...add.ids],
          });
        }
      }
      combined = pruneFront(next);
    }
    return { formation, front: combined };
  });
}

/** Formationsreihenfolge als Tie-Break, analog zum Ranking-Sort in optimizeLineup (lineupOptimizer.ts:187-193). */
export function byFormationOrder(formations: readonly string[]) {
  return (a: { formation: string }, b: { formation: string }) => formations.indexOf(a.formation) - formations.indexOf(b.formation);
}

/**
 * Beste besetzbare Elf mit Gesamtmarktwert ≤ cap (wenigste Auffüller, darunter
 * punktbeste — siehe compareQuality). null, wenn keine Formation innerhalb des
 * Caps besetzbar ist, auch nicht mit Ausfällen als Auffüller.
 */
export function bestLineupUnderValueCap(
  players: readonly OptimizerPlayer[],
  metric: OptimizerMetric,
  formations: readonly string[],
  cap: number,
): CappedPick | null {
  const candidates = buildFormationFronts(players, metric, formations)
    .map(({ formation, front }) => {
      const point = bestUnderCap(front, cap);
      return point && { formation, point };
    })
    .filter((c): c is { formation: string; point: FrontPoint } => Boolean(c));
  if (candidates.length === 0) return null;

  const winner = [...candidates].sort((a, b) => {
    return compareQuality(a.point, b.point) || byFormationOrder(formations)(a, b);
  })[0]!;
  return { formation: winner.formation, playerIds: winner.point.ids, score: winner.point.score, marketValue: winner.point.marketValue };
}

/**
 * Günstigste besetzbare Elf ohne Cap — für den Fall, dass selbst der
 * gesamte verkaufbare Kader das Defizit nicht deckt (siehe sellPlan.ts):
 * dann wird maximal erlöst, indem nur noch diese Elf behalten wird. Der
 * erste Eintrag jeder Formationsfront ist per Konstruktion die wertminimale
 * Kombination für diese Formation (sie kann nie geprunt worden sein, da
 * nichts einen kleineren Marktwert hat). Ein günstiger Ausfall kann darin
 * stehen — hier geht es um Erlös, und ihn zu behalten kostet weniger als
 * einen teureren Fitten; bei gleichem Marktwert gewinnt trotzdem die Elf mit
 * weniger Auffüllern (compareQuality).
 */
export function cheapestLineup(players: readonly OptimizerPlayer[], metric: OptimizerMetric, formations: readonly string[]): CappedPick | null {
  const candidates = buildFormationFronts(players, metric, formations)
    .map(({ formation, front }) => (front.length > 0 ? { formation, point: front[0]! } : null))
    .filter((c): c is { formation: string; point: FrontPoint } => c !== null);
  if (candidates.length === 0) return null;

  const winner = [...candidates].sort((a, b) => {
    if (a.point.marketValue !== b.point.marketValue) return a.point.marketValue - b.point.marketValue;
    return compareQuality(a.point, b.point) || byFormationOrder(formations)(a, b);
  })[0]!;
  return { formation: winner.formation, playerIds: winner.point.ids, score: winner.point.score, marketValue: winner.point.marketValue };
}
