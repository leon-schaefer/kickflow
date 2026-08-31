import { describe, expect, it } from 'vitest';
import type { Position } from '@/api/kickbase';
import type { LineupConstraints } from '@/lineup/rules';
import { bestLineupUnderValueCap, cheapestLineup } from './cappedLineup';
import { bestLineupUnderValueCapWithRules, cheapestLineupWithRules, optimizeLineupWithRules } from './constrainedLineup';
import { AVAILABLE_FORMATIONS, requiredCountsForFormation } from './formations';
import { isAvailableForLineup, metricValue, optimizeLineup, type OptimizerMetric, type OptimizerPlayer } from './lineupOptimizer';
import { buildSellPlan } from './sellPlan';

function makePlayer(overrides: Partial<OptimizerPlayer> & { id: string; position: Position; teamId: string }): OptimizerPlayer {
  return {
    status: 'fit',
    marketValue: 10_000_000,
    averagePoints: 0,
    valueScoreAvg: 0,
    ...overrides,
  };
}

/**
 * Konzentriert die stärksten Spieler auf T1 (DEF) und T2 (MID) — macht eine
 * Vereins-Obergrenze spürbar bindend. Genug Tiefe über 6 Vereine verteilt
 * (statt nur 1-2 Ausweichspieler), damit 4-4-2 unter cap=2 feasible bleibt:
 * sonst reicht die Zahl der Nicht-T1/T2-Alternativen je Position nicht aus.
 */
function concentratedSquad(): OptimizerPlayer[] {
  return [
    makePlayer({ id: 'GK0', position: 'GK', teamId: 'T1', averagePoints: 5, marketValue: 10_000_000 }),
    makePlayer({ id: 'GK1', position: 'GK', teamId: 'T4', averagePoints: 3, marketValue: 3_000_000 }),
    makePlayer({ id: 'DEF0', position: 'DEF', teamId: 'T1', averagePoints: 10, marketValue: 20_000_000 }),
    makePlayer({ id: 'DEF1', position: 'DEF', teamId: 'T1', averagePoints: 9, marketValue: 20_000_000 }),
    makePlayer({ id: 'DEF2', position: 'DEF', teamId: 'T1', averagePoints: 8, marketValue: 20_000_000 }),
    makePlayer({ id: 'DEF3', position: 'DEF', teamId: 'T1', averagePoints: 7, marketValue: 20_000_000 }),
    makePlayer({ id: 'DEF4', position: 'DEF', teamId: 'T2', averagePoints: 6, marketValue: 5_000_000 }),
    makePlayer({ id: 'DEF5', position: 'DEF', teamId: 'T5', averagePoints: 5, marketValue: 5_000_000 }),
    makePlayer({ id: 'DEF6', position: 'DEF', teamId: 'T6', averagePoints: 4, marketValue: 5_000_000 }),
    makePlayer({ id: 'MID0', position: 'MID', teamId: 'T2', averagePoints: 10, marketValue: 20_000_000 }),
    makePlayer({ id: 'MID1', position: 'MID', teamId: 'T2', averagePoints: 9, marketValue: 20_000_000 }),
    makePlayer({ id: 'MID2', position: 'MID', teamId: 'T2', averagePoints: 8, marketValue: 20_000_000 }),
    makePlayer({ id: 'MID3', position: 'MID', teamId: 'T2', averagePoints: 7, marketValue: 20_000_000 }),
    makePlayer({ id: 'MID4', position: 'MID', teamId: 'T3', averagePoints: 6, marketValue: 4_000_000 }),
    makePlayer({ id: 'MID5', position: 'MID', teamId: 'T5', averagePoints: 5, marketValue: 4_000_000 }),
    makePlayer({ id: 'MID6', position: 'MID', teamId: 'T6', averagePoints: 4, marketValue: 4_000_000 }),
    makePlayer({ id: 'FWD0', position: 'FWD', teamId: 'T1', averagePoints: 10, marketValue: 20_000_000 }),
    makePlayer({ id: 'FWD1', position: 'FWD', teamId: 'T2', averagePoints: 9, marketValue: 20_000_000 }),
    makePlayer({ id: 'FWD2', position: 'FWD', teamId: 'T3', averagePoints: 8, marketValue: 6_000_000 }),
    makePlayer({ id: 'FWD3', position: 'FWD', teamId: 'T6', averagePoints: 1, marketValue: 6_000_000 }),
  ];
}

function teamCounts(players: readonly OptimizerPlayer[], ids: readonly string[]): Map<string, number> {
  const byId = new Map(players.map((p) => [p.id, p]));
  const counts = new Map<string, number>();
  for (const id of ids) {
    const teamId = byId.get(id)?.teamId;
    if (!teamId) continue;
    counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
  }
  return counts;
}

function combinations<T>(arr: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first!, ...c]);
  return [...withFirst, ...combinations(rest, k)];
}

/** Vollständige Suche über alle positionsgültigen Kombinationen — Referenz zur Prüfung der DP-Optimalität. */
function bruteForceBestScore(
  players: readonly OptimizerPlayer[],
  metric: OptimizerMetric,
  formation: string,
  maxPerTeam: number,
): number | null {
  const required = requiredCountsForFormation(formation);
  const byPosition: Record<Position, OptimizerPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of players) if (isAvailableForLineup(p.status)) byPosition[p.position].push(p);

  let best: number | null = null;
  for (const gk of combinations(byPosition.GK, required.GK)) {
    for (const def of combinations(byPosition.DEF, required.DEF)) {
      for (const mid of combinations(byPosition.MID, required.MID)) {
        for (const fwd of combinations(byPosition.FWD, required.FWD)) {
          const combo = [...gk, ...def, ...mid, ...fwd];
          const counts = new Map<string, number>();
          for (const p of combo) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
          if ([...counts.values()].some((c) => c > maxPerTeam)) continue;
          const score = combo.reduce((sum, p) => sum + metricValue(p, metric), 0);
          if (best === null || score > best) best = score;
        }
      }
    }
  }
  return best;
}

describe('optimizeLineupWithRules — Exaktheit gegen Brute Force', () => {
  it('findet für mehrere Cap-Werte denselben optimalen Score wie eine vollständige Suche', () => {
    const players = concentratedSquad().filter((p) => p.id !== 'GK1'); // 2. GK raus, hält die Kombinatorik klein
    for (const maxPerTeam of [1, 2, 3]) {
      const constraints: LineupConstraints = { maxPerTeam };
      const result = optimizeLineupWithRules(players, 'points', ['4-4-2'], constraints);
      const expected = bruteForceBestScore(players, 'points', '4-4-2', maxPerTeam);
      expect(result.best?.score ?? null).toBe(expected);
    }
  });
});

describe('Kreuz-Check: maxPerTeam=11 entspricht dem unbeschränkten Optimizer', () => {
  it('liefert für beide Metriken dieselbe Elf und denselben Score wie optimizeLineup', () => {
    const players = concentratedSquad();
    for (const metric of ['points', 'valuePerMillion'] as const) {
      const constrained = optimizeLineupWithRules(players, metric, AVAILABLE_FORMATIONS, { maxPerTeam: 11 });
      const unconstrained = optimizeLineup(players, metric, AVAILABLE_FORMATIONS);
      expect(constrained.best?.formation).toBe(unconstrained.best?.formation);
      expect(constrained.best?.score).toBe(unconstrained.best?.score);
      expect(constrained.best?.playerIds).toEqual(unconstrained.best?.playerIds);
    }
  });
});

describe('bindender Cap', () => {
  it('hält die Obergrenze pro Verein ein und senkt den Score gegenüber der freien Elf', () => {
    const players = concentratedSquad();
    const unconstrained = optimizeLineupWithRules(players, 'points', ['4-4-2']);
    const capped = optimizeLineupWithRules(players, 'points', ['4-4-2'], { maxPerTeam: 2 });
    expect(capped.best).not.toBeNull();
    const counts = teamCounts(players, capped.best!.playerIds);
    expect([...counts.values()].every((c) => c <= 2)).toBe(true);
    expect(capped.best!.score!).toBeLessThan(unconstrained.best!.score!);
  });
});

describe('unerfüllbare Regel', () => {
  it('meldet best=null mit blockedRuleIds, wenn Positionen reichen aber die Regel keine Elf zulässt', () => {
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', teamId: 'T1' }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', teamId: 'T1' })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', teamId: 'T2' })),
      makePlayer({ id: 'FWD0', position: 'FWD', teamId: 'T3' }),
      makePlayer({ id: 'FWD1', position: 'FWD', teamId: 'T3' }),
    ];
    const result = optimizeLineupWithRules(players, 'points', ['4-4-2'], { maxPerTeam: 1 });
    expect(result.best).toBeNull();
    expect(result.blockedRuleIds).toEqual(['maxPerTeam']);
    const entry = result.ranking.find((r) => r.formation === '4-4-2')!;
    expect(entry.missing).toEqual({});
    expect(entry.blockedByRuleIds).toEqual(['maxPerTeam']);
  });
});

describe('Determinismus', () => {
  it('ist unabhängig von der Eingabereihenfolge', () => {
    const players = concentratedSquad();
    const forward = optimizeLineupWithRules(players, 'points', ['4-4-2'], { maxPerTeam: 2 });
    const reversed = optimizeLineupWithRules([...players].reverse(), 'points', ['4-4-2'], { maxPerTeam: 2 });
    expect(reversed.best?.playerIds).toEqual(forward.best?.playerIds);
    expect(reversed.best?.score).toBe(forward.best?.score);
  });
});

describe('Positionsreihenfolge', () => {
  it('liefert playerIds als GK, DEF, MID, FWD', () => {
    const players = concentratedSquad();
    const result = optimizeLineupWithRules(players, 'points', ['4-4-2'], { maxPerTeam: 2 });
    const positionById = new Map(players.map((p) => [p.id, p.position]));
    const rank: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
    const ranks = result.best!.playerIds.map((id) => rank[positionById.get(id)!]);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1]!);
    }
  });
});

describe('bestLineupUnderValueCapWithRules / cheapestLineupWithRules', () => {
  it('delegieren ohne aktive Regeln unverändert an bestLineupUnderValueCap / cheapestLineup', () => {
    const players = concentratedSquad();
    expect(bestLineupUnderValueCapWithRules(players, 'points', ['4-4-2'], 195_000_000)).toEqual(
      bestLineupUnderValueCap(players, 'points', ['4-4-2'], 195_000_000),
    );
    expect(cheapestLineupWithRules(players, 'points', ['4-4-2'])).toEqual(cheapestLineup(players, 'points', ['4-4-2']));
  });

  it('hält die Vereins-Obergrenze auch unter einer Marktwert-Obergrenze ein', () => {
    const players = concentratedSquad();
    const capped = bestLineupUnderValueCapWithRules(players, 'points', ['4-4-2'], 1_000_000_000, { maxPerTeam: 2 });
    expect(capped).not.toBeNull();
    const counts = teamCounts(players, capped!.playerIds);
    expect([...counts.values()].every((c) => c <= 2)).toBe(true);
  });
});

describe('buildSellPlan mit Vereins-Regel', () => {
  it('hält die Regel in der behaltenen Elf ein und deckt weiterhin das Defizit', () => {
    const players = concentratedSquad();
    const plan = buildSellPlan(players, 'points', 9_000_000, ['4-4-2'], { maxPerTeam: 2 });
    expect(plan.feasible).toBe(true);
    const counts = teamCounts(players, plan.result.best?.playerIds ?? []);
    expect([...counts.values()].every((c) => c <= 2)).toBe(true);
  });
});
