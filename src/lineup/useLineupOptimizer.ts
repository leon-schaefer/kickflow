import { useMemo, useState } from 'react';
import type { SquadPlayer } from '@/api/kickbase';
import {
  optimizeLineup,
  type OptimizationResult,
  type OptimizerMetric,
} from '@/utils/lineupOptimizer';
import { deriveSellAdvice, type SellAdvice } from '@/utils/sellAdvice';

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
  /** Ergebnis für die aktive Metrik. */
  result: OptimizationResult;
  /** scoreAverage je Formation, für die Score-Unterzeile der Chips. */
  scoreByFormation: Map<string, number | null>;
  /** Unabhängig von der Metrik — basiert auf beiden Optimierungen zugleich. */
  sellAdvice: SellAdvice[];
  /** Diff der vorgeschlagenen besten Elf gegen die aktuelle Aufstellung. */
  preview: OptimizerDiff;
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
): LineupOptimizer {
  const [metric, setMetric] = useState<OptimizerMetric>('valuePerMillion');

  const efficiencyResult = useMemo(() => optimizeLineup(players, 'valuePerMillion'), [players]);
  const pointsResult = useMemo(() => optimizeLineup(players, 'points'), [players]);
  const result = metric === 'valuePerMillion' ? efficiencyResult : pointsResult;

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

  return { metric, setMetric, result, scoreByFormation, sellAdvice, preview };
}
