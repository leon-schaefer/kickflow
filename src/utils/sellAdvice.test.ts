import { describe, expect, it } from 'vitest';
import type { Position } from '@/api/kickbase';
import { optimizeLineup, type OptimizerPlayer } from './lineupOptimizer';
import { deriveSellAdvice } from './sellAdvice';

function makePlayer(overrides: Partial<OptimizerPlayer> & { id: string; position: Position }): OptimizerPlayer {
  return {
    status: 'fit',
    marketValue: 10_000_000,
    averagePoints: 0,
    valueScoreAvg: 0,
    ...overrides,
  };
}

/** Kader mit 1 GK, 5 DEF, 5 MID, 5 FWD — jede Formation aus AVAILABLE_FORMATIONS besetzbar. */
function baseSquad(
  overrides: Partial<Record<Position, Partial<OptimizerPlayer>[]>> = {},
  sizeOverrides: Partial<Record<Position, number>> = {},
): OptimizerPlayer[] {
  const sizes: Record<Position, number> = { GK: 1, DEF: 5, MID: 5, FWD: 5, ...sizeOverrides };
  const players: OptimizerPlayer[] = [];
  (Object.keys(sizes) as Position[]).forEach((position) => {
    const extra = overrides[position] ?? [];
    for (let i = 0; i < sizes[position]; i++) {
      players.push(
        makePlayer({
          id: `${position}${i}`,
          position,
          averagePoints: 10 - i,
          valueScoreAvg: 10 - i,
          ...extra[i],
        }),
      );
    }
  });
  return players;
}

function advice(players: OptimizerPlayer[]) {
  const efficiency = optimizeLineup(players, 'valuePerMillion');
  const points = optimizeLineup(players, 'points');
  return deriveSellAdvice(players, efficiency, points);
}

function findAdvice(entries: ReturnType<typeof advice>, id: string) {
  return entries.find((e) => e.playerId === id)!;
}

describe('deriveSellAdvice', () => {
  it('Spieler in beiden Optimal-Elfen -> unverzichtbar', () => {
    const result = advice(baseSquad());
    // FWD0 hat in seiner Position den höchsten Wert bei beiden Metriken (Default:
    // valueScoreAvg == averagePoints) und wird deshalb in jeder Formation mit
    // mindestens einem FWD-Slot gewählt — also auch in beiden Optimal-Elfen.
    expect(findAdvice(result, 'FWD0').recommendation).toBe('unverzichtbar');
  });

  it('nur in der Effizienz-Elf -> effizienz-juwel; nur in der Punkte-Elf -> punkte-garant', () => {
    const players = baseSquad({
      FWD: [
        { averagePoints: 5, valueScoreAvg: 50 }, // günstiger Effizienz-Star
        { averagePoints: 20, valueScoreAvg: 2 }, // teurer Punktesammler
      ],
    });
    const result = advice(players);
    expect(findAdvice(result, 'FWD0').recommendation).toBe('effizienz-juwel');
    expect(findAdvice(result, 'FWD1').recommendation).toBe('punkte-garant');
  });

  it('in keiner Elf und teuer -> verkaufen; in keiner Elf und günstig -> beobachten', () => {
    // 6 FWD statt 5: die maximale Formationsanforderung ist 4 FWD (4-2-4), FWD5
    // (schlechtester Wert) landet damit garantiert in keiner Formation.
    const expensive = baseSquad({ FWD: [{}, {}, {}, {}, {}, { marketValue: 90_000_000 }] }, { FWD: 6 });
    const resultExpensive = advice(expensive);
    expect(findAdvice(resultExpensive, 'FWD5').recommendation).toBe('verkaufen');

    const cheap = baseSquad({ FWD: [{}, {}, {}, {}, {}, { marketValue: 1 }] }, { FWD: 6 });
    const resultCheap = advice(cheap);
    expect(findAdvice(resultCheap, 'FWD5').recommendation).toBe('beobachten');
  });

  it('in keiner besten, aber in einer anderen besetzbaren Formation -> rotation', () => {
    // Bewusst konstruiert: 4-4-2 (2 FWD-Slots, MID top4 = 34) schlägt 4-3-3
    // (3 FWD-Slots, MID top3 = 27) um 2 Punkte (268 vs. 266) — FWD2 ist der
    // dritte FWD-Slot in 4-3-3 und landet damit nur dort, nicht in 4-4-2.
    const players = baseSquad({
      FWD: [
        { averagePoints: 100, valueScoreAvg: 100 },
        { averagePoints: 90, valueScoreAvg: 90 },
        { averagePoints: 5, valueScoreAvg: 5 },
        { averagePoints: 1, valueScoreAvg: 1 },
        { averagePoints: 0, valueScoreAvg: 0 },
      ],
    });
    const formations = ['4-4-2', '4-3-3'];
    const efficiency = optimizeLineup(players, 'valuePerMillion', formations);
    const points = optimizeLineup(players, 'points', formations);
    expect(efficiency.best?.formation).toBe('4-4-2');
    expect(efficiency.best?.playerIds).not.toContain('FWD2');
    expect(efficiency.usedInAnyFormation.has('FWD2')).toBe(true);
    const result = deriveSellAdvice(players, efficiency, points);
    expect(findAdvice(result, 'FWD2').recommendation).toBe('rotation');
  });

  it('nicht einsatzfähiger Spieler bleibt "nicht-einsatzbereit", unabhängig vom Marktwert', () => {
    const players = baseSquad({
      FWD: [{ status: 'injured', marketValue: 90_000_000, valueScoreAvg: 1000, averagePoints: 1000 }],
    });
    const result = advice(players);
    expect(findAdvice(result, 'FWD0').recommendation).toBe('nicht-einsatzbereit');
  });

  it('sortiert verkaufen zuerst, absteigend nach Marktwert', () => {
    const players = baseSquad(
      { FWD: [{}, {}, {}, {}, { marketValue: 50_000_000 }, { marketValue: 90_000_000 }] },
      { FWD: 6 },
    );
    const result = advice(players);
    const sellEntries = result.filter((e) => e.recommendation === 'verkaufen');
    expect(sellEntries.map((e) => e.playerId)).toEqual(['FWD5', 'FWD4']);
    expect(result[0]!.recommendation).toBe('verkaufen');
  });

  it('funktioniert ohne besetzbare Formation und wirft nicht', () => {
    // Jede Formation aus AVAILABLE_FORMATIONS braucht mindestens 3 DEF (siehe
    // formations.test.ts) — 2 DEF machen also ausnahmslos alle unbesetzbar.
    const shortSquad = baseSquad({}, { DEF: 2 });
    const efficiency = optimizeLineup(shortSquad, 'valuePerMillion');
    const points = optimizeLineup(shortSquad, 'points');
    expect(efficiency.best).toBeNull();
    expect(points.best).toBeNull();
    const result = deriveSellAdvice(shortSquad, efficiency, points);
    expect(result.length).toBe(shortSquad.length);
  });

  it('genau ein Eintrag je Kaderspieler mit eindeutigen IDs', () => {
    const players = baseSquad();
    const result = advice(players);
    expect(result.length).toBe(players.length);
    expect(new Set(result.map((e) => e.playerId)).size).toBe(players.length);
  });
});
