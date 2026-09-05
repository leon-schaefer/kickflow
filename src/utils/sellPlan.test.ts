import { describe, expect, it } from 'vitest';
import type { PlayerStatus, Position } from '@/api/kickbase';
import { buildSellPlan } from './sellPlan';
import type { OptimizerPlayer } from './lineupOptimizer';

function makePlayer(overrides: Partial<OptimizerPlayer> & { id: string; position: Position }): OptimizerPlayer {
  return {
    status: 'fit',
    teamId: 'T0',
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

  it('verkauft einen Startelfspieler, wenn die Bank allein den Fehlbetrag nicht deckt (Regression)', () => {
    // Deckung ist die harte Nebenbedingung: reicht die Bank nicht, muss ein
    // Startelfspieler dran glauben — auch wenn er im unbeschränkten Optimum
    // stand. GK/DEF/MID sind hier ohne Alternative (je exakt so viele
    // Kandidaten wie die Formation braucht), einzige Freiheit ist FWD
    // (3 Kandidaten für 2 Plätze): FWD0 "Hlozek" (teuer, stark), FWD1
    // (günstig, mittelstark), FWDBench (günstig, schwach).
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', averagePoints: 5, marketValue: 5_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', averagePoints: 5, marketValue: 10_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', averagePoints: 5, marketValue: 10_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', averagePoints: 8, marketValue: 60_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', averagePoints: 6, marketValue: 10_000_000 }),
      makePlayer({ id: 'FWDBench', position: 'FWD', averagePoints: 1, marketValue: 2_000_000 }),
    ];
    // Kader gesamt 157 Mio; FWDBench (2 Mio) allein reicht bei weitem nicht
    // für 55 Mio — aber FWD0 "Hlozek" allein deckt es.
    const plan = buildSellPlan(players, 'points', 55_000_000, ['4-4-2']);
    expect(plan.sell).toEqual([{ playerId: 'FWD0', marketValue: 60_000_000, wasInBestXi: true }]);
    expect(plan.feasible).toBe(true);
    expect(plan.proceeds).toBe(60_000_000);
    expect(plan.balanceAfter).toBe(5_000_000);
    expect(plan.shortfall).toBe(0);
    // Die Restelf ersetzt FWD0 durch FWD1 + FWDBench (die einzige besetzbare Alternative).
    expect(plan.result.best?.playerIds.sort()).toEqual(
      ['GK0', 'DEF0', 'DEF1', 'DEF2', 'DEF3', 'MID0', 'MID1', 'MID2', 'MID3', 'FWD1', 'FWDBench'].sort(),
    );
  });

  it('opfert den Star nicht unnötig, wenn ein kleinerer Fehlbetrag auch günstiger zu decken ist', () => {
    // Gleicher Kader wie oben, aber kleinerer Fehlbetrag: FWD1 abzugeben
    // (statt FWD0 "Hlozek") deckt die 7 Mio bereits — und verliert weniger Punkte.
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', averagePoints: 5, marketValue: 5_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', averagePoints: 5, marketValue: 10_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', averagePoints: 5, marketValue: 10_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', averagePoints: 8, marketValue: 60_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', averagePoints: 6, marketValue: 10_000_000 }),
      makePlayer({ id: 'FWDBench', position: 'FWD', averagePoints: 1, marketValue: 2_000_000 }),
    ];
    const plan = buildSellPlan(players, 'points', 7_000_000, ['4-4-2']);
    expect(plan.sell).toEqual([{ playerId: 'FWD1', marketValue: 10_000_000, wasInBestXi: true }]);
    expect(plan.feasible).toBe(true);
    expect(plan.result.best?.playerIds).toContain('FWD0');
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

  it('streicht einen Verkauf wieder, den ein späterer allein überflüssig macht (Regression)', () => {
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', marketValue: 4_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', marketValue: 4_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', marketValue: 4_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', marketValue: 4_000_000 }),
      // Sportlich der schwächste, deckt die 10 Mio aber nicht allein — die
      // Greedy-Auswahl greift trotzdem zuerst zu ihm.
      makePlayer({ id: 'BenchWeakSmall', position: 'FWD', averagePoints: -100, marketValue: 2_000_000 }),
      // Der nächste Kandidat deckt allein: der erste Verkauf bringt damit nur
      // Überschuss und muss wieder rausfallen.
      makePlayer({ id: 'BenchBig', position: 'FWD', averagePoints: -50, marketValue: 30_000_000 }),
    ];
    const plan = buildSellPlan(players, 'points', 10_000_000, ['4-4-2']);
    expect(plan.sell.map((entry) => entry.playerId)).toEqual(['BenchBig']);
    expect(plan.proceeds).toBe(30_000_000);
    expect(plan.balanceAfter).toBe(20_000_000);
    expect(plan.feasible).toBe(true);
  });

  it('behält beide Verkäufe, wenn keiner allein deckt', () => {
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', marketValue: 4_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', marketValue: 4_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', marketValue: 4_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'BenchA', position: 'FWD', averagePoints: -100, marketValue: 6_000_000 }),
      makePlayer({ id: 'BenchB', position: 'FWD', averagePoints: -50, marketValue: 6_000_000 }),
    ];
    const plan = buildSellPlan(players, 'points', 10_000_000, ['4-4-2']);
    expect(plan.sell.map((entry) => entry.playerId)).toEqual(['BenchA', 'BenchB']);
    expect(plan.feasible).toBe(true);
  });

  it('streicht den großen Verkauf, wenn die kleinen zusammen reichen', () => {
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', marketValue: 4_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', marketValue: 4_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', marketValue: 4_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', marketValue: 4_000_000 }),
      // Zwei schwache Bankspieler decken die 10 Mio exakt — der dritte, sportlich
      // wertvollste Verkauf ist damit überflüssig und wird gestrichen.
      makePlayer({ id: 'BenchA', position: 'FWD', averagePoints: -100, marketValue: 5_000_000 }),
      makePlayer({ id: 'BenchB', position: 'FWD', averagePoints: -90, marketValue: 5_000_000 }),
      makePlayer({ id: 'BenchC', position: 'FWD', averagePoints: -10, marketValue: 20_000_000 }),
    ];
    const plan = buildSellPlan(players, 'points', 10_000_000, ['4-4-2']);
    expect(plan.sell.map((entry) => entry.playerId)).toEqual(['BenchA', 'BenchB']);
    expect(plan.proceeds).toBe(10_000_000);
  });

  it('streicht nichts, wenn der Kader das Defizit ohnehin nicht deckt', () => {
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', marketValue: 4_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', marketValue: 4_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', marketValue: 4_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'BenchA', position: 'FWD', averagePoints: -100, marketValue: 3_000_000 }),
      makePlayer({ id: 'BenchB', position: 'FWD', averagePoints: -90, marketValue: 3_000_000 }),
      makePlayer({ id: 'BenchC', position: 'FWD', averagePoints: -80, marketValue: 3_000_000 }),
    ];
    const plan = buildSellPlan(players, 'points', 500_000_000, ['4-4-2']);
    expect(plan.feasible).toBe(false);
    // Jeder Teilerlös wird gebraucht — der Ausverkauf bleibt vollständig.
    expect(plan.sell.length).toBeGreaterThan(1);
    expect(plan.proceeds).toBe(plan.sell.reduce((sum, entry) => sum + entry.marketValue, 0));
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

describe('buildSellPlan mit ausgeschlossenen Spielern', () => {
  /** Elf für 4-4-2 ohne jede Alternative — die Bank kommt je Test dazu. */
  function starters(): OptimizerPlayer[] {
    return [
      makePlayer({ id: 'GK0', position: 'GK', marketValue: 4_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', marketValue: 4_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', marketValue: 4_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', marketValue: 4_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', marketValue: 4_000_000 }),
    ];
  }

  it('weicht auf den nächsten Kandidaten aus, statt den ausgeschlossenen zu verkaufen', () => {
    const players: OptimizerPlayer[] = [
      ...starters(),
      makePlayer({ id: 'BenchSmall', position: 'FWD', averagePoints: -100, marketValue: 5_000_000 }),
      makePlayer({ id: 'BenchBig', position: 'FWD', averagePoints: -100, marketValue: 8_000_000 }),
    ];
    // Ohne Ausschluss deckt der kleinere Kandidat den Fehlbetrag exakt.
    expect(buildSellPlan(players, 'points', 5_000_000, ['4-4-2']).sell[0]!.playerId).toBe('BenchSmall');

    const plan = buildSellPlan(players, 'points', 5_000_000, ['4-4-2'], undefined, new Set(['BenchSmall']));
    expect(plan.sell).toEqual([{ playerId: 'BenchBig', marketValue: 8_000_000, wasInBestXi: false }]);
    expect(plan.feasible).toBe(true);
    expect(plan.balanceAfter).toBe(3_000_000);
    expect(plan.excludedCount).toBe(1);
    expect(plan.excludedValue).toBe(5_000_000);
  });

  it('rechnet den ausgeschlossenen Marktwert nicht als Erlös mit (Cap über den verkaufbaren Kader)', () => {
    // "Hlozek"-Kader: einzige Freiheit ist FWD. Ohne Ausschluss deckt FWD1
    // (10 Mio) die 7 Mio und der Star FWD0 bleibt — ist FWD1 ausgeschlossen,
    // bleibt nur noch FWD0, denn FWDBench (2 Mio) reicht nicht.
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', averagePoints: 5, marketValue: 5_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) => makePlayer({ id, position: 'DEF', averagePoints: 5, marketValue: 10_000_000 })),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) => makePlayer({ id, position: 'MID', averagePoints: 5, marketValue: 10_000_000 })),
      makePlayer({ id: 'FWD0', position: 'FWD', averagePoints: 8, marketValue: 60_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', averagePoints: 6, marketValue: 10_000_000 }),
      makePlayer({ id: 'FWDBench', position: 'FWD', averagePoints: 1, marketValue: 2_000_000 }),
    ];
    expect(buildSellPlan(players, 'points', 7_000_000, ['4-4-2']).sell[0]!.playerId).toBe('FWD1');

    const plan = buildSellPlan(players, 'points', 7_000_000, ['4-4-2'], undefined, new Set(['FWD1']));
    expect(plan.sell).toEqual([{ playerId: 'FWD0', marketValue: 60_000_000, wasInBestXi: true }]);
    expect(plan.feasible).toBe(true);
    // Der ausgeschlossene Spieler steht danach selbstverständlich in der Elf.
    expect(plan.result.best?.playerIds).toContain('FWD1');
  });

  it('meldet einen Fehlbetrag, wenn nur ausgeschlossene Spieler Erlös bringen könnten', () => {
    // Der ausgeschlossene Bankspieler ist verletzt und kann deshalb auch
    // keinen verkauften Startelfspieler ersetzen — es gibt also tatsächlich
    // nichts zu verkaufen, ohne die einzige Formation zu sprengen.
    const players: OptimizerPlayer[] = [
      ...starters(),
      makePlayer({ id: 'Bench', position: 'FWD', status: 'injured' as PlayerStatus, marketValue: 5_000_000 }),
    ];
    const plan = buildSellPlan(players, 'points', 3_000_000, ['4-4-2'], undefined, new Set(['Bench']));
    expect(plan.sell).toEqual([]);
    expect(plan.proceeds).toBe(0);
    expect(plan.feasible).toBe(false);
    expect(plan.shortfall).toBe(3_000_000);
    // Genau die Zahl, mit der die UI den Fehlbetrag erklärt.
    expect(plan.excludedValue).toBe(5_000_000);
  });

  it('ändert ohne Defizit nichts, meldet die Ausschlüsse aber mit', () => {
    const players: OptimizerPlayer[] = [
      ...starters(),
      makePlayer({ id: 'Bench', position: 'FWD', averagePoints: -100, marketValue: 5_000_000 }),
    ];
    const plan = buildSellPlan(players, 'points', 0, ['4-4-2'], undefined, new Set(['Bench']));
    expect(plan.sell).toEqual([]);
    expect(plan.feasible).toBe(true);
    expect(plan.excludedCount).toBe(1);
    expect(plan.excludedValue).toBe(5_000_000);
  });

  it('ist ohne Ausschlüsse identisch zum bisherigen Plan', () => {
    const players: OptimizerPlayer[] = [
      ...starters(),
      makePlayer({ id: 'BenchSmall', position: 'FWD', averagePoints: -100, marketValue: 5_000_000 }),
      makePlayer({ id: 'BenchBig', position: 'FWD', averagePoints: -100, marketValue: 8_000_000 }),
    ];
    expect(buildSellPlan(players, 'points', 6_000_000, ['4-4-2'], undefined, new Set())).toEqual(
      buildSellPlan(players, 'points', 6_000_000, ['4-4-2']),
    );
    // Eine ID, die gar nicht im Kader steht, darf ebenfalls nichts ändern.
    expect(buildSellPlan(players, 'points', 6_000_000, ['4-4-2'], undefined, new Set(['GHOST']))).toEqual(
      buildSellPlan(players, 'points', 6_000_000, ['4-4-2']),
    );
  });

  it('verkauft auch bei vollständigem Ausschluss des Kaders nichts', () => {
    const players: OptimizerPlayer[] = [
      ...starters(),
      makePlayer({ id: 'Bench', position: 'FWD', averagePoints: -100, marketValue: 5_000_000 }),
    ];
    const plan = buildSellPlan(
      players,
      'points',
      50_000_000,
      ['4-4-2'],
      undefined,
      new Set(players.map((p) => p.id)),
    );
    expect(plan.sell).toEqual([]);
    expect(plan.feasible).toBe(false);
    expect(plan.shortfall).toBe(50_000_000);
    // Die Elf bleibt trotzdem besetzt — Ausschlüsse betreffen nie die Optimierung.
    expect(plan.result.best?.playerIds.length).toBe(11);
  });
});
