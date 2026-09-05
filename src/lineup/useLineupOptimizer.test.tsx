import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import type { Position, SquadPlayer } from '@/api/kickbase';
import { squadPlayer } from '@/test/squadPlayer';
import { useLineupOptimizer } from './useLineupOptimizer';

/**
 * Hält die Rangfolge der Zielwerte fest (siehe utils/lineupOptimizer.ts):
 * Punkte sind das Ziel, Effizienz ist Tie-Break und Transfer-Signal. Der Test
 * prüft die Voreinstellung des Hooks — die reine Auswahllogik je Metrik liegt
 * in utils/lineupOptimizer.test.ts.
 */

/**
 * Kader mit 6 Spielern je Feldposition, damit jede Formation aus
 * AVAILABLE_FORMATIONS besetzbar ist. Spieler `i` einer Position hat
 * absteigende Ø-Punkte und dazu AUFSTEIGENDE Ø-Punkte/Mio — die punktbeste
 * und die effizienteste Elf sind damit auf jeder Position gegensätzlich.
 */
function squad(): SquadPlayer[] {
  const players: SquadPlayer[] = [];
  const counts: Record<Position, number> = { GK: 2, DEF: 6, MID: 6, FWD: 6 };
  for (const position of ['GK', 'DEF', 'MID', 'FWD'] as Position[]) {
    for (let i = 0; i < counts[position]; i++) {
      players.push(
        squadPlayer({
          id: `${position}${i}`,
          position,
          averagePoints: 100 - i,
          valueScoreAvg: 1 + i,
          marketValue: 10_000_000,
        }),
      );
    }
  }
  return players;
}

/** Ø-Punkte der Elf, aufsummiert — die Größe, die am Spieltag ausgezahlt wird. */
function totalPoints(players: readonly SquadPlayer[], ids: readonly string[]): number {
  const byId = new Map(players.map((p) => [p.id, p]));
  return ids.reduce((sum, id) => sum + (byId.get(id)?.averagePoints ?? 0), 0);
}

describe('useLineupOptimizer — Voreinstellung', () => {
  it('optimiert ohne Zutun auf Punkte, nicht auf Ø-Punkte/Mio', () => {
    const players = squad();
    const { result } = renderHook(() => useLineupOptimizer(players, []));

    expect(result.current.metric).toBe('points');
    // 11 Slots, je Position die höchsten Ø-Punkte (Index 0 aufwärts).
    expect(result.current.result.best?.playerIds).not.toContain('MID5');
    expect(result.current.result.best?.playerIds).toContain('MID0');
  });

  it('holt mit der Voreinstellung mehr Punkte als die Effizienz-Elf', () => {
    const players = squad();
    const { result } = renderHook(() => useLineupOptimizer(players, []));

    const pointsXi = totalPoints(players, result.current.result.best!.playerIds);

    act(() => result.current.setMetric('valuePerMillion'));
    const efficiencyXi = totalPoints(players, result.current.result.best!.playerIds);

    expect(pointsXi).toBeGreaterThan(efficiencyXi);
  });
});
