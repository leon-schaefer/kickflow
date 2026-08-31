import { describe, expect, it } from 'vitest';
import type { PlayerStatus, Position } from '@/api/kickbase';
import { buildSellPlan } from './sellPlan';
import type { OptimizerPlayer } from './lineupOptimizer';

function makePlayer(overrides: Partial<OptimizerPlayer> & { id: string; position: Position }): OptimizerPlayer {
  return {
    status: 'fit',
    marketValue: 10_000_000,
    averagePoints: 0,
    valueScoreAvg: 0,
    ...overrides,
  };
}

describe('buildSellPlan', () => {
  it('liefert einen leeren, erfüllten Plan ohne Defizit', () => {
    // Exakt 11 Spieler für 4-3-3 (def4+mid3+fwd3+GK1).
    const players = [
      makePlayer({ id: 'GK0', position: 'GK', averagePoints: 5 }),
      makePlayer({ id: 'DEF0', position: 'DEF', averagePoints: 5 }),
      makePlayer({ id: 'DEF1', position: 'DEF', averagePoints: 4 }),
      makePlayer({ id: 'DEF2', position: 'DEF', averagePoints: 3 }),
      makePlayer({ id: 'DEF3', position: 'DEF', averagePoints: 2 }),
      makePlayer({ id: 'MID0', position: 'MID', averagePoints: 5 }),
      makePlayer({ id: 'MID1', position: 'MID', averagePoints: 4 }),
      makePlayer({ id: 'MID2', position: 'MID', averagePoints: 3 }),
      makePlayer({ id: 'FWD0', position: 'FWD', averagePoints: 5 }),
      makePlayer({ id: 'FWD1', position: 'FWD', averagePoints: 4 }),
      makePlayer({ id: 'FWD2', position: 'FWD', averagePoints: 3 }),
    ];
    const plan = buildSellPlan(players, 'points', 0, ['4-3-3']);
    expect(plan.sell).toEqual([]);
    expect(plan.feasible).toBe(true);
    expect(plan.proceeds).toBe(0);
    expect(plan.balanceAfter).toBe(0);
    expect(plan.shortfall).toBe(0);
  });

  it('deckt das Defizit allein von der Bank, ohne die Elf zu verändern', () => {
    // 4-4-2: GK1, DEF4, MID4, FWD2 — je 1 Bankspieler bei DEF/MID, 3 bei FWD.
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', averagePoints: 5 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id, i) =>
        makePlayer({ id, position: 'DEF', averagePoints: 10 - i, marketValue: 20_000_000 }),
      ),
      makePlayer({ id: 'DEF4', position: 'DEF', averagePoints: 1, marketValue: 5_000_000 }),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id, i) =>
        makePlayer({ id, position: 'MID', averagePoints: 10 - i, marketValue: 20_000_000 }),
      ),
      makePlayer({ id: 'MID4', position: 'MID', averagePoints: 1, marketValue: 4_000_000 }),
      makePlayer({ id: 'FWD0', position: 'FWD', averagePoints: 10, marketValue: 20_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', averagePoints: 9, marketValue: 20_000_000 }),
      makePlayer({ id: 'FWD2', position: 'FWD', averagePoints: 1, marketValue: 6_000_000 }),
    ];
    const plan = buildSellPlan(players, 'points', 9_000_000, ['4-4-2']);
    expect(plan.feasible).toBe(true);
    expect(plan.sell.every((entry) => !entry.wasInBestXi)).toBe(true);
    expect(plan.scoreLoss).toBe(0);
    expect(plan.result.best?.playerIds.sort()).toEqual(
      ['GK0', 'DEF0', 'DEF1', 'DEF2', 'DEF3', 'MID0', 'MID1', 'MID2', 'MID3', 'FWD0', 'FWD1'].sort(),
    );
  });

  it('bleibt lieber unerfüllt, als die Startelf zu verkleinern — jede Formation braucht exakt 11', () => {
    // Jede Formation summiert auf genau 11 Spieler (optimizeLineup prüft das
    // hart) — die Bank hat daher strukturell immer genau (Kadergröße − 11)
    // Plätze, und der erste Verkauf über die Bank hinaus würde den Kader
    // unter 11 drücken und JEDE Formation unbesetzbar machen. buildSellPlan
    // bricht deshalb ab, statt die Startelf zu verkleinern.
    const benchPosition = (id: string): Position => (id.startsWith('DEF') ? 'DEF' : id.startsWith('MID') ? 'MID' : 'FWD');
    const bench = ['DEF4', 'MID4', 'FWD2', 'FWD3', 'FWD4'].map((id) =>
      makePlayer({ id, position: benchPosition(id), averagePoints: -100, marketValue: 1_000_000 }),
    );
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', marketValue: 20_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', marketValue: 20_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', marketValue: 20_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', marketValue: 20_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', marketValue: 20_000_000 }),
      ...bench,
    ];
    // Bank (5 × 1 Mio = 5 Mio) reicht bei weitem nicht für 50 Mio.
    const plan = buildSellPlan(players, 'points', 50_000_000, ['4-4-2']);
    expect(plan.sell).toHaveLength(5);
    expect(plan.sell.every((entry) => !entry.wasInBestXi)).toBe(true);
    expect(plan.proceeds).toBe(5_000_000);
    expect(plan.feasible).toBe(false);
    expect(plan.shortfall).toBe(45_000_000);
    expect(plan.scoreLoss).toBe(0);
    // Die Startelf steht am Ende exakt noch da, unangetastet.
    expect(plan.result.best?.playerIds.sort()).toEqual(
      ['GK0', 'DEF0', 'DEF1', 'DEF2', 'DEF3', 'MID0', 'MID1', 'MID2', 'MID3', 'FWD0', 'FWD1'].sort(),
    );
  });

  it('verkauft nie einen Spieler, der jede Formation unbesetzbar machen würde', () => {
    // Exakt 11 Spieler für 4-4-2, kein Bankspieler — jeder Verkauf würde die einzige Formation sprengen.
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', averagePoints: 5, marketValue: 4_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', marketValue: 4_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', marketValue: 4_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', marketValue: 4_000_000 }),
    ];
    const plan = buildSellPlan(players, 'points', 100_000_000, ['4-4-2']);
    expect(plan.sell).toEqual([]);
    expect(plan.feasible).toBe(false);
    expect(plan.shortfall).toBe(100_000_000);
  });

  it('meldet einen Fehlbetrag, wenn der Kader nach dem Ausverkauf der Bank nicht mehr reicht', () => {
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', marketValue: 4_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', marketValue: 4_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', marketValue: 4_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', marketValue: 4_000_000 }),
      // einziger Bankspieler, in keiner Formation benötigt
      makePlayer({ id: 'FWD2', position: 'FWD', averagePoints: -100, marketValue: 5_000_000 }),
    ];
    const plan = buildSellPlan(players, 'points', 50_000_000, ['4-4-2']);
    expect(plan.sell).toEqual([{ playerId: 'FWD2', marketValue: 5_000_000, wasInBestXi: false }]);
    expect(plan.feasible).toBe(false);
    expect(plan.proceeds).toBe(5_000_000);
    expect(plan.shortfall).toBe(45_000_000);
  });

  it('verkauft nicht einsatzfähige Spieler zuerst (Kosten 0, unabhängig vom Marktwert)', () => {
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', marketValue: 4_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', marketValue: 4_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', marketValue: 4_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', marketValue: 4_000_000 }),
      // gesperrter Spieler, sehr wertvoll, aber ohnehin in keiner Elf.
      makePlayer({ id: 'FWDsus', position: 'FWD', status: 'suspended' as PlayerStatus, marketValue: 50_000_000 }),
      // gesunder, ungenutzter Bankspieler, deutlich weniger wert.
      makePlayer({ id: 'FWDbench', position: 'FWD', averagePoints: -100, marketValue: 3_000_000 }),
    ];
    const plan = buildSellPlan(players, 'points', 7_000_000, ['4-4-2']);
    expect(plan.sell[0]!.playerId).toBe('FWDsus');
    expect(plan.scoreLoss).toBe(0);
  });

  it('Exact-Fit-Tiebreak: unter mehreren deckenden Kandidaten gewinnt der kleinste', () => {
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', marketValue: 4_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', marketValue: 4_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', marketValue: 4_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'BenchSmall', position: 'FWD', averagePoints: -100, marketValue: 5_000_000 }),
      makePlayer({ id: 'BenchBig', position: 'FWD', averagePoints: -100, marketValue: 8_000_000 }),
    ];
    const plan = buildSellPlan(players, 'points', 5_000_000, ['4-4-2']);
    expect(plan.sell).toEqual([{ playerId: 'BenchSmall', marketValue: 5_000_000, wasInBestXi: false }]);
  });

  it('ohne deckenden Kandidaten gewinnt der größte Marktwert (weniger Verkäufe nötig)', () => {
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', marketValue: 4_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', marketValue: 4_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', marketValue: 4_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'BenchSmall', position: 'FWD', averagePoints: -100, marketValue: 3_000_000 }),
      makePlayer({ id: 'BenchBig', position: 'FWD', averagePoints: -100, marketValue: 8_000_000 }),
    ];
    // Kein Kandidat deckt 10 Mio allein (3 Mio und 8 Mio) — der größere Marktwert gewinnt.
    const plan = buildSellPlan(players, 'points', 10_000_000, ['4-4-2']);
    expect(plan.sell[0]!.playerId).toBe('BenchBig');
  });

  it('ist bei identischen Marktwerten deterministisch (id aufsteigend)', () => {
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', marketValue: 4_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', marketValue: 4_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', marketValue: 4_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'BenchZ', position: 'FWD', averagePoints: -100, marketValue: 5_000_000 }),
      makePlayer({ id: 'BenchA', position: 'FWD', averagePoints: -100, marketValue: 5_000_000 }),
    ];
    const forward = buildSellPlan(players, 'points', 5_000_000, ['4-4-2']);
    const reversed = buildSellPlan([...players].reverse(), 'points', 5_000_000, ['4-4-2']);
    expect(forward.sell[0]!.playerId).toBe('BenchA');
    expect(reversed.sell[0]!.playerId).toBe('BenchA');
  });
});
