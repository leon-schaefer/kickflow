import { NO_EXCLUSIONS } from '@/lineup/excludedFromSale';
import { UNCONSTRAINED_CONSTRAINTS, type LineupConstraints } from '@/lineup/rules';
import { bestLineupUnderValueCapWithRules, cheapestLineupWithRules, optimizeLineupWithRules } from './constrainedLineup';
import { AVAILABLE_FORMATIONS } from './formations';
import {
  isAvailableForLineup,
  metricValue,
  type OptimizationResult,
  type OptimizerMetric,
  type OptimizerPlayer,
} from './lineupOptimizer';

/**
 * Berechnet, welche Kaderspieler verkauft werden müssten, um einen
 * negativen Kontostand auszugleichen — für die "Konto ausgleichen"-Option
 * des Aufstellungs-Optimizers (siehe useLineupOptimizer.ts).
 *
 * Die Deckung des Defizits ist die harte Nebenbedingung, der Punkteverlust
 * das Optimierungsziel darunter — auch ein Startelfspieler muss dran
 * glauben, wenn nur die Bank nicht reicht. Schlüssel-Einsicht: der Punktwert
 * der Restaufstellung hängt nur von der BEHALTENEN Elf ab, nicht davon, wen
 * man konkret verkauft — bei gewählter Elf ist der maximal erzielbare Erlös
 * `Σ Marktwert aller Spieler − Marktwert der Elf`. Also gilt
 *
 *     Defizit deckbar  ⟺  Marktwert der Elf ≤ Σ Marktwert − Defizit
 *
 * Aus "welche Teilmenge verkaufen" (Rucksackproblem) wird damit "beste Elf
 * unter einer Marktwert-Obergrenze" — gelöst per Pareto-DP in
 * `cappedLineup.ts`, global optimal statt greedy. Reicht selbst der gesamte
 * verkaufbare Kader nicht (siehe `cheapestLineup`), wird maximal erlöst:
 * nur noch die günstigste besetzbare Elf bleibt stehen, der Rest wird zum
 * Verkauf vorgeschlagen.
 *
 * Unter den danach nicht mehr benötigten Spielern wird nur so viel verkauft,
 * wie zur Deckung nötig ist — Priorität: nicht einsatzfähige zuerst (kosten
 * die Restelf nichts), dann die wenigsten Punkte pro Mio Marktwert, dann
 * (bei Gleichstand) wer den Restfehlbetrag allein deckt bzw. der größere
 * Marktwert, um mit möglichst wenigen Verkäufen auszukommen.
 *
 * Diese Auswahl ist greedy und schaut nicht zurück, deshalb räumt
 * `dropRedundantSales` hinterher auf: deckt ein später gewählter Verkauf den
 * Fehlbetrag allein, werden die vorher eingesammelten wieder gestrichen. Ohne
 * den Schritt stünden Spieler als Pflichtverkauf in der Liste, deren Erlös
 * niemand braucht.
 *
 * Vom Nutzer vom Verkauf ausgeschlossene Spieler (`excludedIds`, siehe
 * src/lineup/excludedFromSale.ts) sind für den Plan unverkäuflich. Die
 * Rechnung oben bleibt dieselbe, nur zählt der ausgeschlossene Marktwert
 * nirgends mehr als Erlös: verkauft wird aus `Σ Marktwert der VERKAUFBAREN`,
 * und in der Cap-Bedingung zählt nur der verkaufbare Anteil der Elf —
 *
 *     Defizit deckbar  ⟺  Marktwert der verkaufbaren Elf-Spieler
 *                          ≤ Σ Marktwert verkaufbar − Defizit
 *
 * Technisch fällt das mit dem bestehenden Verfahren zusammen, indem für die
 * Auswahl der behaltenen Elf der Marktwert ausgeschlossener Spieler auf 0
 * gesetzt wird (`sellableValues` unten): sie zu behalten kostet keinen Erlös,
 * weil sie ohnehin nie verkauft werden. Der Punktwert bleibt unberührt —
 * `metricValue` liest nie den Marktwert (siehe lineupOptimizer.ts).
 *
 * Vorbehalt für die UI: `proceeds` ist eine Schätzung zum Marktwert. Ein
 * Verkauf an einen Mitspieler kann darüber liegen, ein Verkauf an Kickbase
 * (Bot-Listing) liegt exakt beim Marktwert.
 */

export interface SellPlanEntry {
  playerId: string;
  marketValue: number;
  /** true, wenn der Spieler in der unbeschränkten (kein Budget-Cap) Optimalelf stand. */
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
  /**
   * Marktwert der vom Verkauf ausgeschlossenen Spieler — was der Plan bewusst
   * nicht anfassen durfte. Für die UI: erklärt einen Fehlbetrag, den ein
   * Aufheben von Ausschlüssen decken könnte.
   */
  excludedValue: number;
  /** Anzahl der ausgeschlossenen Kaderspieler. */
  excludedCount: number;
}

/**
 * Totale Ordnung für die Verkaufsreihenfolge unter den nicht mehr benötigten
 * Spielern (jenen außerhalb der behaltenen Elf): (a) nicht einsatzfähige
 * zuerst — die kosten die Restelf ohnehin nichts; (b) sonst die wenigsten
 * Punkte pro Mio Marktwert (`metricValue`) zuerst; (c) bei Gleichstand ein
 * Kandidat, der den Restfehlbetrag allein deckt, vor einem, der es nicht
 * tut — davon der kleinste, um den Überschuss zu minimieren; sonst der
 * größte Marktwert, um mit möglichst wenigen Verkäufen auszukommen; (d) id
 * aufsteigend für Determinismus bei exaktem Gleichstand (Vorbild:
 * compareByMetric in lineupOptimizer.ts).
 */
function compareSaleCandidates(a: OptimizerPlayer, b: OptimizerPlayer, metric: OptimizerMetric, remainingDeficit: number): number {
  const aFit = isAvailableForLineup(a.status);
  const bFit = isAvailableForLineup(b.status);
  if (aFit !== bFit) return aFit ? 1 : -1;
  const byMetric = metricValue(a, metric) - metricValue(b, metric);
  if (byMetric !== 0) return byMetric;
  const aCovers = a.marketValue >= remainingDeficit;
  const bCovers = b.marketValue >= remainingDeficit;
  if (aCovers !== bCovers) return aCovers ? -1 : 1;
  const byValue = aCovers ? a.marketValue - b.marketValue : b.marketValue - a.marketValue;
  return byValue !== 0 ? byValue : a.id.localeCompare(b.id);
}

/**
 * Streicht Verkäufe, die der Plan nicht braucht. `selectSales` greift immer
 * zum sportlich billigsten Kandidaten und schaut nie zurück — deckt der
 * NÄCHSTE Kandidat den Fehlbetrag dann allein, waren alle vorher gewählten
 * umsonst. Sie bringen nur Überschuss, den niemand verlangt hat, und kosten
 * dafür je einen Kaderspieler.
 *
 * Geprüft wird von hinten nach vorn, also vom zuletzt gewählten (sportlich
 * teuersten) Verkauf zum ersten. Ein Verkauf fällt nur weg, wenn der Rest das
 * Defizit weiterhin deckt. Damit wird zuerst versucht, den wertvollsten
 * Spieler zu retten; erst wenn der unverzichtbar ist, fallen die davor
 * eingesammelten Kleinigkeiten weg — nie umgekehrt.
 *
 * Ein Streichen macht den Plan nie schlechter: der Restkader wird größer, und
 * `buildSellPlan` optimiert die Elf ohnehin auf dem, was übrig bleibt. Deckt
 * der ganze Pool das Defizit nicht (`feasible === false`), streicht die
 * Schleife nichts — jeder Teilerlös wird gebraucht.
 */
function dropRedundantSales(chosen: readonly OptimizerPlayer[], deficit: number): OptimizerPlayer[] {
  const kept = [...chosen];
  let proceeds = kept.reduce((sum, player) => sum + player.marketValue, 0);
  // Rückwärts, damit ein Splice die noch zu prüfenden Indizes nicht verschiebt.
  for (let i = kept.length - 1; i >= 0; i--) {
    if (proceeds - kept[i]!.marketValue >= deficit) {
      proceeds -= kept[i]!.marketValue;
      kept.splice(i, 1);
    }
  }
  return kept;
}

/** Verkauft aus `pool` der Reihe nach (siehe compareSaleCandidates), bis proceeds ≥ deficit oder der Pool leer ist. */
function selectSales(pool: readonly OptimizerPlayer[], metric: OptimizerMetric, deficit: number): OptimizerPlayer[] {
  let remaining = [...pool];
  let proceeds = 0;
  const chosen: OptimizerPlayer[] = [];

  while (proceeds < deficit && remaining.length > 0) {
    const remainingDeficit = deficit - proceeds;
    const winner = [...remaining].sort((a, b) => compareSaleCandidates(a, b, metric, remainingDeficit))[0]!;
    chosen.push(winner);
    proceeds += winner.marketValue;
    remaining = remaining.filter((p) => p.id !== winner.id);
  }

  return chosen;
}

export function buildSellPlan(
  players: readonly OptimizerPlayer[],
  metric: OptimizerMetric,
  deficit: number,
  formations: readonly string[] = AVAILABLE_FORMATIONS,
  constraints: LineupConstraints = UNCONSTRAINED_CONSTRAINTS,
  /** Vom Nutzer vom Verkauf ausgeschlossene Spieler — für den Plan unverkäuflich. */
  excludedIds: ReadonlySet<string> = NO_EXCLUSIONS,
): SellPlan {
  const unconstrained = optimizeLineupWithRules(players, metric, formations, constraints);
  const excluded = players.filter((p) => excludedIds.has(p.id));
  const excludedValue = excluded.reduce((sum, p) => sum + p.marketValue, 0);
  const excludedCount = excluded.length;

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
      excludedValue,
      excludedCount,
    };
  }

  const sellableMarketValue = players.reduce((sum, p) => sum + (excludedIds.has(p.id) ? 0 : p.marketValue), 0);
  const cap = sellableMarketValue - deficit;

  // Ausgeschlossene Spieler mit Marktwert 0 — nur für die Auswahl der
  // behaltenen Elf (siehe Modul-Doku): sie zu behalten kostet keinen Erlös.
  // Ohne Ausschlüsse ist das die unveränderte Eingabe und damit exakt der
  // bisherige Pfad.
  const sellableValues =
    excludedCount > 0 ? players.map((p) => (excludedIds.has(p.id) ? { ...p, marketValue: 0 } : p)) : players;

  // bestLineupUnderValueCap === null: selbst der gesamte verkaufbare Kader
  // reicht nicht aus, um unter den Cap zu kommen — dann wird maximal erlöst
  // (nur noch die günstigste besetzbare Elf bleibt stehen).
  const keep =
    bestLineupUnderValueCapWithRules(sellableValues, metric, formations, cap, constraints) ??
    cheapestLineupWithRules(sellableValues, metric, formations, constraints);

  const keepIds = new Set(keep?.playerIds ?? []);
  const pool = players.filter((p) => !keepIds.has(p.id) && p.marketValue > 0 && !excludedIds.has(p.id));
  const chosen = dropRedundantSales(selectSales(pool, metric, deficit), deficit);

  const unconstrainedBestIds = new Set(unconstrained.best?.playerIds ?? []);
  const sell: SellPlanEntry[] = chosen.map((player) => ({
    playerId: player.id,
    marketValue: player.marketValue,
    wasInBestXi: unconstrainedBestIds.has(player.id),
  }));
  const proceeds = chosen.reduce((sum, p) => sum + p.marketValue, 0);

  const soldIds = new Set(chosen.map((p) => p.id));
  const result = optimizeLineupWithRules(
    players.filter((p) => !soldIds.has(p.id)),
    metric,
    formations,
    constraints,
  );

  const feasible = proceeds >= deficit;
  const unconstrainedScore = unconstrained.best?.score ?? null;
  const finalScore = result.best?.score ?? null;
  const scoreLoss = unconstrainedScore !== null && finalScore !== null ? unconstrainedScore - finalScore : 0;

  return {
    sell,
    proceeds,
    balanceAfter: proceeds - deficit,
    result,
    scoreLoss,
    feasible,
    shortfall: feasible ? 0 : deficit - proceeds,
    excludedValue,
    excludedCount,
  };
}
