import { useMemo, useState } from 'react';
import type { SquadPlayer } from '@/api/kickbase';
import {
  optimizeLineup,
  type OptimizationResult,
  type OptimizerMetric,
} from '@/utils/lineupOptimizer';
import { deriveSellAdvice, type SellAdvice } from '@/utils/sellAdvice';
import { buildSellPlan, type SellPlan } from '@/utils/sellPlan';

export interface OptimizerDiff {
  /** Vom Optimizer neu in die Elf geholt (gegenüber der aktuellen Aufstellung). */
  addedIds: Set<string>;
  /** Vom Optimizer auf die Bank geschickt. */
  removedIds: Set<string>;
  changeCount: number;
}

export interface LineupOptimizer {
  metric: OptimizerMetric;
  setMetric: (m: OptimizerMetric) => void;
  /** Ergebnis für die aktive Metrik — bei aktivem `balanceBudget` bereits die budgetbereinigte Elf. */
  result: OptimizationResult;
  /** scoreAverage je Formation, für die Score-Unterzeile der Chips. */
  scoreByFormation: Map<string, number | null>;
  /** Unabhängig von der Metrik — basiert auf beiden Optimierungen zugleich. */
  sellAdvice: SellAdvice[];
  /** Diff der vorgeschlagenen besten Elf gegen die aktuelle Aufstellung. */
  preview: OptimizerDiff;
  /** "Konto ausgleichen" — bezieht Pflichtverkäufe zum Ausgleich eines negativen Kontostands mit ein. */
  balanceBudget: boolean;
  setBalanceBudget: (value: boolean) => void;
  /** Nur gesetzt, wenn balanceBudget aktiv UND ein Defizit besteht — siehe utils/sellPlan.ts. */
  sellPlan: SellPlan | null;
}

function diffAgainstDraft(bestPlayerIds: readonly string[] | undefined, draftIds: readonly string[]): OptimizerDiff {
  const best = new Set(bestPlayerIds ?? []);
  const current = new Set(draftIds);
  const addedIds = new Set([...best].filter((id) => !current.has(id)));
  const removedIds = new Set([...current].filter((id) => !best.has(id)));
  return { addedIds, removedIds, changeCount: Math.max(addedIds.size, removedIds.size) };
}

/**
 * Hält ausschließlich State und Memoisierung — jede Entscheidung bleibt in
 * den testbaren, reinen Modulen `lineupOptimizer.ts`/`sellAdvice.ts`. Beide
 * Metriken werden immer berechnet (günstig bei ~15–25 Spielern), weil
 * `sellAdvice` beide braucht; ein Toggle ist damit ein reines Neu-Auswählen,
 * keine Neuberechnung, und die Empfehlungsliste flackert beim Umschalten nicht.
 */
export function useLineupOptimizer(
  players: readonly SquadPlayer[],
  draftIds: readonly string[],
  deficit = 0,
): LineupOptimizer {
  const [metric, setMetric] = useState<OptimizerMetric>('valuePerMillion');
  const [balanceBudget, setBalanceBudget] = useState(false);

  const efficiencyResult = useMemo(() => optimizeLineup(players, 'valuePerMillion'), [players]);
  const pointsResult = useMemo(() => optimizeLineup(players, 'points'), [players]);
  const unconstrainedResult = metric === 'valuePerMillion' ? efficiencyResult : pointsResult;

  // Nur für die AKTIVE Metrik berechnet, nicht wie efficiencyResult/pointsResult
  // für beide zugleich — sellAdvice (unten) braucht den Sell-Plan nicht, und
  // ein Metrikwechsel bei aktiver Checkbox berechnet ohnehin neu.
  const sellPlan = useMemo(
    () => (balanceBudget && deficit > 0 ? buildSellPlan(players, metric, deficit) : null),
    [players, metric, deficit, balanceBudget],
  );

  // Bei aktivem balanceBudget hat der Kontoausgleich Priorität vor Punkten —
  // auch ein nicht voll feasible-r Plan (Kader reicht nicht ganz) verkauft
  // bereits das Maximal-Mögliche und liefert die dazu beste Restkader-Elf;
  // das ist der Elf mit unbeschränkter Punktoptimierung immer vorzuziehen.
  const result = sellPlan ? sellPlan.result : unconstrainedResult;

  const scoreByFormation = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const entry of result.ranking) map.set(entry.formation, entry.scoreAverage);
    return map;
  }, [result]);

  const sellAdvice = useMemo(
    () => deriveSellAdvice(players, efficiencyResult, pointsResult),
    [players, efficiencyResult, pointsResult],
  );

  const preview = useMemo(
    () => diffAgainstDraft(result.best?.playerIds, draftIds),
    [result, draftIds],
  );

  return { metric, setMetric, result, scoreByFormation, sellAdvice, preview, balanceBudget, setBalanceBudget, sellPlan };
}
