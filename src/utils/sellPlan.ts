import { AVAILABLE_FORMATIONS } from './formations';
import { optimizeLineup, type OptimizationResult, type OptimizerMetric, type OptimizerPlayer } from './lineupOptimizer';

/**
 * Berechnet, welche Kaderspieler verkauft werden müssten, um einen
 * negativen Kontostand auszugleichen — für die "Konto ausgleichen"-Option
 * des Aufstellungs-Optimizers (siehe useLineupOptimizer.ts).
 *
 * Exakt wäre das ein Rucksackproblem (Marktwert gegen Punkteverlust über
 * alle Teilmengen); bei 15–25 Kaderspielern reicht dafür ein Greedy mit
 * Neu-Optimierung nach jedem Verkauf: in jeder Runde wird der Spieler
 * verkauft, der pro verkauftem Euro die wenigsten Punkte kostet (cost /
 * marketValue minimal), danach wird die beste Elf auf dem Restkader neu
 * berechnet, bevor die nächste Runde beginnt. Nicht einsatzfähige und
 * ungenutzte Bankspieler kosten dabei 0 Punkte und werden deshalb immer
 * zuerst verkauft — ohne Sonderfall, das fällt aus der Kostenformel von
 * selbst heraus. Ein Verkauf, der jede Formation unbesetzbar machen würde,
 * hat unendliche Kosten und wird nie gewählt.
 *
 * Vorbehalt für die UI: `proceeds` ist eine Schätzung zum Marktwert. Ein
 * Verkauf an einen Mitspieler kann darüber liegen, ein Verkauf an Kickbase
 * (Bot-Listing) liegt exakt beim Marktwert.
 */

export interface SellPlanEntry {
  playerId: string;
  marketValue: number;
  /** true, wenn der Spieler zum Zeitpunkt dieses Verkaufs in der besten Elf des Restkaders stand. */
  wasInBestXi: boolean;
}

export interface SellPlan {
  /** Verkäufe in Auswahlreihenfolge. */
  sell: SellPlanEntry[];
  /** Summe der Marktwerte der Verkäufe — geschätzter Erlös. */
  proceeds: number;
  /** Kontostand nach den Verkäufen (kann > 0 sein, wenn proceeds das Defizit übersteigt). */
  balanceAfter: number;
  /** Beste Elf auf dem Restkader nach allen (möglichen) Verkäufen. */
  result: OptimizationResult;
  /** Punkteverlust der Restkader-Elf gegenüber der unbeschränkten Optimal-Elf. */
  scoreLoss: number;
  /** true, wenn proceeds >= deficit erreicht wurde. */
  feasible: boolean;
  /** Fehlender Betrag, falls der Kader nicht ausreicht (0, wenn feasible). */
  shortfall: number;
}

interface Candidate {
  player: OptimizerPlayer;
  result: OptimizationResult;
  ratio: number;
}

/**
 * Totale Ordnung für Kandidaten mit gleichem ratio (typischerweise ratio=0
 * bei Bank-/Ausfallspielern): (a) ein Kandidat, der den Restfehlbetrag
 * allein deckt, geht vor einem, der es nicht tut — davon der kleinste, um
 * den Überschuss zu minimieren; (b) sonst der größte Marktwert, um die
 * Anzahl nötiger Verkäufe zu minimieren; (c) id aufsteigend, damit die
 * Auswahl bei exaktem Gleichstand deterministisch bleibt (Vorbild:
 * compareByMetric in lineupOptimizer.ts).
 */
function compareCandidates(a: Candidate, b: Candidate, remainingDeficit: number): number {
  if (a.ratio !== b.ratio) return a.ratio - b.ratio;
  const aCovers = a.player.marketValue >= remainingDeficit;
  const bCovers = b.player.marketValue >= remainingDeficit;
  if (aCovers !== bCovers) return aCovers ? -1 : 1;
  const byValue = aCovers ? a.player.marketValue - b.player.marketValue : b.player.marketValue - a.player.marketValue;
  return byValue !== 0 ? byValue : a.player.id.localeCompare(b.player.id);
}

export function buildSellPlan(
  players: readonly OptimizerPlayer[],
  metric: OptimizerMetric,
  deficit: number,
  formations: readonly string[] = AVAILABLE_FORMATIONS,
): SellPlan {
  const unconstrained = optimizeLineup(players, metric, formations);

  if (deficit <= 0) {
    return {
      sell: [],
      proceeds: 0,
      // `-deficit` statt `0 - deficit`: bei deficit === 0 vermeidet das eine
      // negative Null, die mit Object.is-Vergleichen (z.B. toBe) als ungleich auffällt.
      balanceAfter: deficit === 0 ? 0 : -deficit,
      result: unconstrained,
      scoreLoss: 0,
      feasible: true,
      shortfall: 0,
    };
  }

  let remaining = [...players];
  let current = unconstrained;
  const sell: SellPlanEntry[] = [];
  let proceeds = 0;

  while (proceeds < deficit) {
    const currentScore = current.best?.score ?? null;
    const currentBestIds = new Set(current.best?.playerIds ?? []);
    const candidates = remaining.filter((p) => p.marketValue > 0);
    if (candidates.length === 0) break;

    const remainingDeficit = deficit - proceeds;
    const evaluated: Candidate[] = candidates.map((player) => {
      const withoutPlayer = remaining.filter((p) => p.id !== player.id);
      const result = optimizeLineup(withoutPlayer, metric, formations);
      // currentScore === null: schon der Restkader hat keine besetzbare Elf
      // — dann gibt es nichts zu verlieren, jeder Verkauf kostet 0 Punkte.
      // result.best!.score ist nie null, wenn result.best gesetzt ist (siehe
      // optimizeLineup: best wird nur bei feasible: true zugewiesen).
      const cost = currentScore === null ? 0 : result.best ? currentScore - result.best.score! : Infinity;
      return { player, result, ratio: cost / player.marketValue };
    });

    const winner = evaluated.sort((a, b) => compareCandidates(a, b, remainingDeficit))[0]!;
    if (!Number.isFinite(winner.ratio)) break; // jeder verbleibende Verkauf würde jede Formation unbesetzbar machen

    sell.push({
      playerId: winner.player.id,
      marketValue: winner.player.marketValue,
      wasInBestXi: currentBestIds.has(winner.player.id),
    });
    proceeds += winner.player.marketValue;
    remaining = remaining.filter((p) => p.id !== winner.player.id);
    current = winner.result;
  }

  const feasible = proceeds >= deficit;
  const unconstrainedScore = unconstrained.best?.score ?? null;
  const finalScore = current.best?.score ?? null;
  const scoreLoss = unconstrainedScore !== null && finalScore !== null ? unconstrainedScore - finalScore : 0;

  return {
    sell,
    proceeds,
    balanceAfter: proceeds - deficit,
    result: current,
    scoreLoss,
    feasible,
    shortfall: feasible ? 0 : deficit - proceeds,
  };
}
