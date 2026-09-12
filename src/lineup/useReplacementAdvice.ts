import { useMemo } from 'react';
import type { MarketPlayer, SquadPlayer } from '@/api/kickbase';
import { UNCONSTRAINED_CONSTRAINTS, type LineupConstraints } from '@/lineup/rules';
import type { BudgetLimit } from '@/utils/budget';
import type { AverageDifficulty } from '@/utils/fixtureDifficulty';
import { withExpectedPoints } from '@/utils/fixtureDifficulty';
import { AVAILABLE_FORMATIONS } from '@/utils/formations';
import type { OptimizerMetric } from '@/utils/lineupOptimizer';
import { deriveReplacementAdvice, type ReplacementAdvice } from '@/utils/replacementAdvice';

/**
 * Die Kaufseite des Optimizers als Hook — Gegenstück zu useLineupOptimizer.ts
 * und wie dieser reine Memo-Hülle: jede Entscheidung steht in
 * `utils/replacementAdvice.ts` und `utils/bidAdvice.ts`.
 *
 * BEWUSST EIN EIGENER HOOK und kein weiterer Rückgabewert von
 * useLineupOptimizer: die Eingaben sind andere. Der Zukauf braucht den
 * Transfermarkt und den 33%-Rahmen — zwei Quellen, die die Verkaufsseite nie
 * anfasst und die ein Aufsteller ohne Marktdaten auch nicht bekommt.
 *
 * `metric` und `constraints` kommen von außen und stammen im echten Baum aus
 * derselben useLineupOptimizer-Instanz (siehe LineupScreen.tsx). Das ist keine
 * Bequemlichkeit: der Zugewinn wird gegen die ANGEZEIGTE Elf gemessen, und
 * eine hier eigenständig aus den Regeln abgeleitete Schranke würde ein
 * Session-„Ignorieren" nicht kennen.
 *
 * Kein `enabled`-Schalter wie bei usePurchases: das hier kostet keine
 * Requests, nur eine Optimierung je Listing (siehe Modul-Doku dort). Die
 * Empfehlung steht damit schon in der zugeklappten Kopfzeile — genau dort, wo
 * sie gebraucht wird. Gerechnet wird nur, wenn sich Kader, Markt, Metrik,
 * Schranken oder Budget ändern.
 */
export function useReplacementAdvice(
  players: readonly SquadPlayer[],
  market: readonly MarketPlayer[],
  metric: OptimizerMetric,
  constraints: LineupConstraints = UNCONSTRAINED_CONSTRAINTS,
  /**
   * Der 33%-Rahmen (utils/budget.ts). `null` = noch unbekannt, dann deckelt
   * kein Budget das Gebot. Das ganze Limit statt nur `available`, weil der
   * Spielraum je Kandidat ein anderer ist, sobald ich auf ihn schon geboten
   * habe (siehe `availableForRebid`). Als Memo-Abhängigkeit unkritisch:
   * useBudgetLimit memoisiert es, eine neue Referenz kommt nur mit neuen
   * Liga- oder Marktdaten — und neue Marktdaten ändern hier ohnehin `market`.
   */
  budget: BudgetLimit | null = null,
  /** Restprogramm-Härte je Verein — dieselbe Map wie beim Optimizer, siehe LineupScreen.tsx. */
  fixtureDifficultyByTeam?: ReadonlyMap<string, AverageDifficulty>,
): ReplacementAdvice {
  // Beide Seiten mit DERSELBEN Gewichtung anreichern, sonst wird der Zugewinn
  // gegen eine anders gerechnete Elf gemessen (siehe withExpectedPoints).
  const squad = useMemo(
    () => withExpectedPoints(players, fixtureDifficultyByTeam),
    [players, fixtureDifficultyByTeam],
  );
  const listings = useMemo(
    () => withExpectedPoints(market, fixtureDifficultyByTeam),
    [market, fixtureDifficultyByTeam],
  );

  return useMemo(
    () =>
      deriveReplacementAdvice({
        players: squad,
        market: listings,
        metric,
        formations: AVAILABLE_FORMATIONS,
        constraints,
        budget,
      }),
    [squad, listings, metric, constraints, budget],
  );
}
