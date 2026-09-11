import { useEffect, useMemo, useState } from 'react';
import type { SquadPlayer } from '@/api/kickbase';
import { NO_EXCLUSIONS } from '@/lineup/excludedFromSale';
import {
  DEFAULT_RULES,
  toConstraints,
  violatedRules,
  type LineupConstraints,
  type LineupRule,
} from '@/lineup/rules';
import { optimizeLineupWithRules } from '@/utils/constrainedLineup';
import type { AverageDifficulty } from '@/utils/fixtureDifficulty';
import { withExpectedPoints } from '@/utils/fixtureDifficulty';
import { AVAILABLE_FORMATIONS } from '@/utils/formations';
import type { OptimizationResult, OptimizerMetric } from '@/utils/lineupOptimizer';
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
  /** Ergebnis für die aktive Metrik — bei aktivem `balanceBudget` bereits die budgetbereinigte Elf. Berücksichtigt die effektiven Regeln. */
  result: OptimizationResult;
  /** scoreAverage je Formation, für die Score-Unterzeile der Chips. */
  scoreByFormation: Map<string, number | null>;
  /** Basiert auf beiden Optimierungen zugleich; bei negativem Konto zusätzlich auf `budgetPlan`. */
  sellAdvice: SellAdvice[];
  /** Diff der vorgeschlagenen besten Elf gegen die aktuelle Aufstellung. */
  preview: OptimizerDiff;
  /** "Konto ausgleichen" — bezieht Pflichtverkäufe zum Ausgleich eines negativen Kontostands mit ein. */
  balanceBudget: boolean;
  setBalanceBudget: (value: boolean) => void;
  /** Nur gesetzt, wenn balanceBudget aktiv UND ein Defizit besteht — siehe utils/sellPlan.ts. */
  sellPlan: SellPlan | null;
  /** Derselbe Plan, aber unabhängig von der Checkbox — nur gesetzt, wenn ein Defizit besteht. Treibt die Pflichtverkäufe in sellAdvice. */
  budgetPlan: SellPlan | null;
  /** Liga-eigene Optimizer-Regeln (src/lineup/rules.ts) — inkl. dauerhaft deaktivierter. */
  rules: readonly LineupRule[];
  /**
   * Die Schranken, unter denen dieser Optimizer gerade rechnet — inklusive
   * eines Session-„Ignorieren" (siehe `ignoreRule`). Nach außen gegeben, damit
   * die Kaufseite (src/lineup/useReplacementAdvice.ts) garantiert unter
   * DENSELBEN Schranken rechnet: ein Zugewinn, der eine ignorierte Regel wieder
   * erzwingt, wäre gegen eine andere Elf gemessen als die angezeigte.
   */
  constraints: LineupConstraints;
  /** Einmalig für diese Optimierung ignorieren (Session-only) — zurückgesetzt bei Regeländerung oder Liga-Wechsel. */
  ignoreRule: (id: LineupRule['id']) => void;
  /** Aktive Regeln, die die AKTUELLE (manuell bearbeitete) Elf verletzen. Der Optimizer bindet nur sich selbst hart — manuelle Eingriffe bleiben immer erlaubt. */
  draftViolations: LineupRule[];
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
 * den testbaren, reinen Modulen `lineupOptimizer.ts`/`constrainedLineup.ts`/
 * `sellAdvice.ts`. Beide Metriken werden immer berechnet (günstig bei
 * ~15–25 Spielern), weil `sellAdvice` beide braucht; ein Toggle ist damit für
 * die Elf ein reines Neu-Auswählen, keine Neuberechnung. Einzige Ausnahme ist
 * der Pflichtverkaufsplan bei negativem Konto (`budgetPlan`): der hängt an der
 * aktiven Metrik und wird beim Umschalten neu berechnet — dafür nennen
 * Kaufen/Verkaufen-Liste und "Konto ausgleichen" garantiert dieselben Spieler.
 */
export function useLineupOptimizer(
  players: readonly SquadPlayer[],
  draftIds: readonly string[],
  deficit = 0,
  rules: readonly LineupRule[] = DEFAULT_RULES,
  /**
   * Restprogramm-Härte je Verein (siehe src/utils/fixtureDifficulty.ts),
   * gemittelt über die nächsten paar Spieltage — vom Aufrufer (lineup.tsx)
   * aus `useMatchdays` gebaut. Ohne diese Map (z. B. Spielplan noch nicht
   * geladen) verhält sich die Metrik 'expectedPoints' wie 'points'.
   */
  fixtureDifficultyByTeam?: Map<string, AverageDifficulty>,
  /**
   * Vom Nutzer vom Verkauf ausgeschlossene Spieler (siehe
   * src/lineup/excludedFromSale.ts). Wirkt NUR auf die Verkaufsseite —
   * Verkaufsvorschlag und Kontoausgleich —, nie auf die Optimierung der Elf:
   * ein ausgeschlossener Spieler soll ja gerade weiter aufgestellt werden.
   */
  excludedFromSaleIds: ReadonlySet<string> = NO_EXCLUSIONS,
): LineupOptimizer {
  // Voreinstellung 'points', nicht 'valuePerMillion': eine Elf aufzustellen
  // kostet nichts — der Kader ist bereits gekauft. Ohne Budget-Nebenbedingung
  // ist die Zielfunktion schlicht "möglichst viele Punkte", und Ø-Punkte/Mio
  // maximiert stattdessen eine Summe von Quotienten, die niemand gutgeschrieben
  // bekommt. Auch mit Nebenbedingung bleibt 'points' richtig: der Kontoausgleich
  // (`sellPlan`) legt eine Marktwert-Obergrenze an und maximiert die Punkte
  // DARUNTER (Pareto-DP in utils/cappedLineup.ts) — ein echtes Rucksackproblem,
  // für das die Quotientensumme ebenfalls nur eine Heuristik wäre. Ø-Punkte/Mio
  // bleibt als Chip erhalten, denn als TRANSFER-Signal ist die Effizienz genau
  // richtig — sie treibt sellAdvice (`efficiencyResult` unten).
  const [metric, setMetric] = useState<OptimizerMetric>('points');
  const [balanceBudget, setBalanceBudget] = useState(false);
  const [ignoredRuleIds, setIgnoredRuleIds] = useState<Set<LineupRule['id']>>(new Set());

  // Ein Ignorieren soll nie eine geänderte Regel stillschweigend überdauern.
  useEffect(() => {
    // Der Funktions-Updater mit Identitäts-Check ist nicht Kosmetik: ein
    // `setIgnoredRuleIds(new Set())` setzt IMMER einen neuen Wert, React kann
    // also nie abbrechen. Übergibt ein Aufrufer `rules` als pro Render neu
    // gebautes Array, dreht sich daraus eine endlose Render-Schleife —
    // synchron, also fängt sie auch kein Test-Timeout. So bleibt der State
    // gleich, wenn es nichts zu leeren gibt.
    setIgnoredRuleIds((current) => (current.size === 0 ? current : new Set()));
  }, [rules]);

  const effectiveRules = useMemo(
    () => rules.filter((rule) => rule.enabled && !ignoredRuleIds.has(rule.id)),
    [rules, ignoredRuleIds],
  );
  const constraints = useMemo(() => toConstraints(effectiveRules), [effectiveRules]);

  // Nur für die neue 'expectedPoints'-Metrik angereichert — efficiencyResult/
  // pointsResult unten bleiben bewusst auf den unveränderten `players`, damit
  // diese Erweiterung ihr bisheriges Verhalten unter keinen Umständen ändert.
  const playersWithExpectedPoints = useMemo(
    () => withExpectedPoints(players, fixtureDifficultyByTeam),
    [players, fixtureDifficultyByTeam],
  );

  const efficiencyResult = useMemo(
    () => optimizeLineupWithRules(players, 'valuePerMillion', AVAILABLE_FORMATIONS, constraints),
    [players, constraints],
  );
  const pointsResult = useMemo(
    () => optimizeLineupWithRules(players, 'points', AVAILABLE_FORMATIONS, constraints),
    [players, constraints],
  );
  const expectedPointsResult = useMemo(
    () => optimizeLineupWithRules(playersWithExpectedPoints, 'expectedPoints', AVAILABLE_FORMATIONS, constraints),
    [playersWithExpectedPoints, constraints],
  );
  const unconstrainedResult =
    metric === 'valuePerMillion' ? efficiencyResult : metric === 'points' ? pointsResult : expectedPointsResult;

  // Immer berechnet, sobald das Konto im Minus ist — die Kaufen/Verkaufen-Liste
  // zeigt die Pflichtverkäufe auch ohne aktive Checkbox und außerhalb des
  // Edit-Modus. Nur für die AKTIVE Metrik, nicht wie efficiencyResult/
  // pointsResult für beide zugleich.
  const budgetPlan = useMemo(
    () =>
      deficit > 0
        ? buildSellPlan(players, metric, deficit, AVAILABLE_FORMATIONS, constraints, excludedFromSaleIds)
        : null,
    [players, metric, deficit, constraints, excludedFromSaleIds],
  );
  // Die Checkbox entscheidet nur noch, ob der Plan auch die ANGEZEIGTE Elf
  // bestimmt — gerechnet wird er ohnehin.
  const sellPlan = balanceBudget ? budgetPlan : null;

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

  // Die ID-Liste bewusst INNERHALB des Memos ableiten: ein pro Render neu
  // gebautes Array würde die Memoisierung sofort entwerten.
  const sellAdvice = useMemo(
    () =>
      deriveSellAdvice(
        players,
        efficiencyResult,
        pointsResult,
        budgetPlan?.sell.map((entry) => entry.playerId) ?? [],
        excludedFromSaleIds,
      ),
    [players, efficiencyResult, pointsResult, budgetPlan, excludedFromSaleIds],
  );

  const preview = useMemo(
    () => diffAgainstDraft(result.best?.playerIds, draftIds),
    [result, draftIds],
  );

  const draftViolations = useMemo(() => violatedRules(rules, players, draftIds), [rules, players, draftIds]);

  function ignoreRule(id: LineupRule['id']) {
    setIgnoredRuleIds((current) => new Set(current).add(id));
  }

  return {
    metric,
    setMetric,
    result,
    scoreByFormation,
    sellAdvice,
    preview,
    balanceBudget,
    setBalanceBudget,
    sellPlan,
    budgetPlan,
    rules,
    constraints,
    ignoreRule,
    draftViolations,
  };
}
