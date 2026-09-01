import { describe, expect, it } from 'vitest';
import type { PlayerStatus, Position } from '@/api/kickbase';
import { bestLineupUnderValueCap, cheapestLineup } from './cappedLineup';
import type { OptimizerPlayer } from './lineupOptimizer';
import { optimizeLineup } from './lineupOptimizer';

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

// 4-4-2: GK1, DEF4, MID4, FWD2 — je 1 Bankspieler bei DEF/MID, 3 bei FWD.
function makeSquad(): OptimizerPlayer[] {
  return [
    makePlayer({ id: 'GK0', position: 'GK', averagePoints: 5, marketValue: 10_000_000 }),
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
}

describe('bestLineupUnderValueCap', () => {
  it('liefert bei nicht bindendem Cap dieselbe Elf wie optimizeLineup', () => {
    const players = makeSquad();
    const unconstrained = optimizeLineup(players, 'points', ['4-4-2']);
    const capped = bestLineupUnderValueCap(players, 'points', ['4-4-2'], 1_000_000_000);
    expect(capped?.playerIds.sort()).toEqual(unconstrained.best?.playerIds.sort());
    expect(capped?.score).toBe(unconstrained.best?.score);
  });

  it('zwingt zu einer billigeren, schwächeren Elf, wenn der Cap die freie Optimal-Elf ausschließt', () => {
    const players = makeSquad();
    // Freie Elf (GK0,DEF0-3,MID0-3,FWD0,FWD1) kostet 10+80+80+40=210 Mio.
    // Cap darunter zwingt dazu, mindestens einen teuren Starter gegen die
    // günstigere Bank zu tauschen.
    const capped = bestLineupUnderValueCap(players, 'points', ['4-4-2'], 195_000_000);
    expect(capped).not.toBeNull();
    expect(capped!.marketValue).toBeLessThanOrEqual(195_000_000);
    const unconstrained = optimizeLineup(players, 'points', ['4-4-2']);
    expect(capped!.score).toBeLessThan(unconstrained.best!.score!);
  });

  it('liefert null, wenn keine Formation unter dem Cap besetzbar ist', () => {
    const players = makeSquad();
    const cheapestPossible = players.reduce((sum, p) => sum + p.marketValue, 0);
    // Cap unter dem Marktwert des allergünstigsten Kaders jeder Formation.
    expect(bestLineupUnderValueCap(players, 'points', ['4-4-2'], 1)).toBeNull();
    expect(cheapestPossible).toBeGreaterThan(1);
  });

  it('ignoriert nicht einsatzfähige Spieler bei der Elf-Bildung', () => {
    const players = makeSquad().map((p) => (p.id === 'FWD0' ? { ...p, status: 'injured' as PlayerStatus } : p));
    const capped = bestLineupUnderValueCap(players, 'points', ['4-4-2'], 1_000_000_000);
    expect(capped?.playerIds).not.toContain('FWD0');
  });

  it('ist bei identischen (marketValue, score)-Kombinationen deterministisch', () => {
    // FWD1 und FWD2 mit vertauschten IDs, aber identischen Werten — die Wahl
    // darf nicht von der Eingabereihenfolge abhängen.
    const players = makeSquad().map((p) => (p.id === 'FWD2' ? { ...p, averagePoints: 9, marketValue: 20_000_000 } : p));
    const forward = bestLineupUnderValueCap(players, 'points', ['4-4-2'], 1_000_000_000);
    const reversed = bestLineupUnderValueCap([...players].reverse(), 'points', ['4-4-2'], 1_000_000_000);
    expect(forward?.playerIds.sort()).toEqual(reversed?.playerIds.sort());
  });
});

describe('cheapestLineup', () => {
  it('wählt je Position die günstigsten besetzbaren Spieler', () => {
    const players = makeSquad();
    const cheapest = cheapestLineup(players, 'points', ['4-4-2']);
    // DEF4 (5 Mio) und MID4 (4 Mio) sind die günstigsten Alternativen zu den
    // 20-Mio-Startern, FWD2 (6 Mio) günstiger als FWD0/FWD1 (20 Mio) — die
    // günstigste Elf tauscht also je einen Bankspieler pro Gruppe ein.
    expect(cheapest?.playerIds).toEqual(expect.arrayContaining(['DEF4', 'MID4']));
    expect(cheapest?.playerIds).toContain('FWD2');
  });

  it('liefert null, wenn keine Formation besetzbar ist', () => {
    const players = [makePlayer({ id: 'GK0', position: 'GK' })];
    expect(cheapestLineup(players, 'points', ['4-4-2'])).toBeNull();
  });
});
