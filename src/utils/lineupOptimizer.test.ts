import { describe, expect, it } from 'vitest';
import type { PlayerStatus, Position } from '@/api/kickbase';
import { AVAILABLE_FORMATIONS } from './formations';
import { isAvailableForLineup, optimizeLineup, type OptimizerPlayer } from './lineupOptimizer';

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

/**
 * Baut einen Kader mit den gegebenen Positionsgrößen (Default: 1/5/5/5, damit
 * jede Formation aus AVAILABLE_FORMATIONS besetzbar ist). `overrides[position][i]`
 * überschreibt einzelne Felder des i-ten Spielers dieser Position.
 */
function squad(
  counts: Partial<Record<Position, number>> = {},
  overrides: Partial<Record<Position, Partial<OptimizerPlayer>[]>> = {},
): OptimizerPlayer[] {
  const sizes: Record<Position, number> = { GK: 1, DEF: 5, MID: 5, FWD: 5, ...counts };
  const players: OptimizerPlayer[] = [];
  (Object.keys(sizes) as Position[]).forEach((position) => {
    const extra = overrides[position] ?? [];
    for (let i = 0; i < sizes[position]; i++) {
      const id = `${position}${i}`;
      players.push(
        makePlayer({
          id,
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

const fullSquad = (overrides: Partial<Record<Position, Partial<OptimizerPlayer>[]>> = {}) => squad({}, overrides);

describe('isAvailableForLineup', () => {
  it('fit/doubtful/unknown sind verfügbar, der Rest nicht', () => {
    const available: PlayerStatus[] = ['fit', 'doubtful', 'unknown'];
    const unavailable: PlayerStatus[] = ['injured', 'rehab', 'suspended', 'away'];
    available.forEach((s) => expect(isAvailableForLineup(s)).toBe(true));
    unavailable.forEach((s) => expect(isAvailableForLineup(s)).toBe(false));
  });
});

describe('optimizeLineup', () => {
  it('wählt je Position die besten Spieler nach Ø-Punkte/Mio', () => {
    const players = fullSquad();
    const result = optimizeLineup(players, 'valuePerMillion');
    // Bei gleichem Werteverlauf je Position (10,9,8,7,6) gewinnt 3-4-3: die
    // Summe der Präfixsummen ist dort maximal (siehe Modul-Doku zum Vorbehalt
    // "Effizienz, nicht Fußball") und 3-4-3 steht in AVAILABLE_FORMATIONS vor
    // dem gleichauf liegenden 4-3-3.
    expect(result.best?.formation).toBe('3-4-3');
    expect(result.best?.playerIds.sort()).toEqual(
      ['GK0', 'DEF0', 'DEF1', 'DEF2', 'MID0', 'MID1', 'MID2', 'MID3', 'FWD0', 'FWD1', 'FWD2'].sort(),
    );
  });

  it('Metrik "points" wählt eine andere Elf als "valuePerMillion"', () => {
    // Ein Spieler ist günstig und effizient, aber punktet absolut wenig; der andere
    // ist teuer, ineffizient, aber liefert die meisten Rohpunkte.
    const players = fullSquad({
      FWD: [
        { averagePoints: 5, valueScoreAvg: 50 }, // günstiger Effizienz-Star
        { averagePoints: 20, valueScoreAvg: 2 }, // teurer Punktesammler
      ],
    });
    const byEfficiency = optimizeLineup(players, 'valuePerMillion');
    const byPoints = optimizeLineup(players, 'points');
    expect(byEfficiency.best?.playerIds).toContain('FWD0');
    expect(byPoints.best?.playerIds).toContain('FWD1');
    expect(byEfficiency.best?.playerIds).not.toEqual(byPoints.best?.playerIds);
  });

  it('Gleichstand: höhere Ø-Punkte gewinnt (Schlüssel 2)', () => {
    // Drei Spieler mit identischer Effizienz, aber nur 2 FWD-Slots (4-4-2) —
    // der Sekundärschlüssel (Ø-Punkte) entscheidet, wer von den Dreien rausfliegt.
    const players = fullSquad({
      FWD: [
        { valueScoreAvg: 10, averagePoints: 5 },
        { valueScoreAvg: 10, averagePoints: 8 },
        { valueScoreAvg: 10, averagePoints: 3 },
      ],
    });
    const result = optimizeLineup(players, 'valuePerMillion', ['4-4-2']);
    expect(result.best?.playerIds).toContain('FWD1');
    expect(result.best?.playerIds).toContain('FWD0');
    expect(result.best?.playerIds).not.toContain('FWD2');
  });

  it('Gleichstand: kleinere ID gewinnt (Schlüssel 3)', () => {
    const players = fullSquad({
      FWD: [
        { id: 'FWDz', valueScoreAvg: 10, averagePoints: 5 },
        { id: 'FWDa', valueScoreAvg: 10, averagePoints: 5 },
        { id: 'FWDm', valueScoreAvg: 10, averagePoints: 5 },
      ],
    });
    const result = optimizeLineup(players, 'valuePerMillion', ['4-4-2']);
    expect(result.best?.playerIds).toContain('FWDa');
    expect(result.best?.playerIds).toContain('FWDm');
    expect(result.best?.playerIds).not.toContain('FWDz');
  });

  it('Ergebnis ist unabhängig von der Eingabereihenfolge', () => {
    const players = fullSquad();
    const forward = optimizeLineup(players, 'valuePerMillion');
    const reversed = optimizeLineup([...players].reverse(), 'valuePerMillion');
    expect(reversed.ranking).toEqual(forward.ranking);
  });

  it('negative Punkte sortieren korrekt und machen eine Formation nicht unbesetzbar', () => {
    const players = fullSquad({
      MID: [{ averagePoints: -20, valueScoreAvg: -5 }],
    });
    const result = optimizeLineup(players, 'points', ['4-4-2']);
    expect(result.best?.feasible).toBe(true);
    expect(Number.isFinite(result.best?.score)).toBe(true);
  });

  it('meldet nicht besetzbare Formationen ohne kurze Elf auszugeben', () => {
    const players = squad({ DEF: 3 });
    const result = optimizeLineup(players, 'valuePerMillion');
    const fiveThree2 = result.ranking.find((r) => r.formation === '5-3-2')!;
    expect(fiveThree2.feasible).toBe(false);
    expect(fiveThree2.missing).toEqual({ DEF: 2 });
    expect(fiveThree2.score).toBeNull();
    expect(fiveThree2.playerIds).toEqual([]);
    for (const entry of result.ranking) {
      expect(entry.playerIds.length === 0 || entry.playerIds.length === 11).toBe(true);
    }
  });

  it('ohne verfügbaren Torwart ist keine Formation besetzbar', () => {
    const players = fullSquad().map((p) => (p.position === 'GK' ? { ...p, status: 'injured' as const } : p));
    const result = optimizeLineup(players, 'valuePerMillion');
    expect(result.best).toBeNull();
    expect(result.ranking.every((r) => !r.feasible)).toBe(true);
  });

  it('leerer Kader wirft nicht', () => {
    const result = optimizeLineup([], 'valuePerMillion');
    expect(result.best).toBeNull();
    expect(result.ranking.length).toBe(AVAILABLE_FORMATIONS.length);
    expect(result.usedInAnyFormation.size).toBe(0);
  });

  it('schließt verletzte, gesperrte und abwesende Spieler aus, doubtful/unknown bleiben verfügbar', () => {
    const players = fullSquad({
      FWD: [
        { status: 'injured', valueScoreAvg: 1000, averagePoints: 1000 },
        { status: 'suspended', valueScoreAvg: 1000, averagePoints: 1000 },
        { status: 'away', valueScoreAvg: 1000, averagePoints: 1000 },
        { status: 'doubtful' },
        { status: 'unknown' },
      ],
    });
    const result = optimizeLineup(players, 'valuePerMillion');
    expect(result.excludedPlayerIds.sort()).toEqual(['FWD0', 'FWD1', 'FWD2'].sort());
    for (const id of ['FWD0', 'FWD1', 'FWD2']) {
      expect(result.usedInAnyFormation.has(id)).toBe(false);
    }
  });

  it('Ranking: besetzbare absteigend nach score, nicht besetzbare am Ende', () => {
    const players = squad({ DEF: 3 });
    const result = optimizeLineup(players, 'valuePerMillion');
    const feasibleScores = result.ranking.filter((r) => r.feasible).map((r) => r.score!);
    for (let i = 1; i < feasibleScores.length; i++) {
      expect(feasibleScores[i]).toBeLessThanOrEqual(feasibleScores[i - 1]!);
    }
    const firstInfeasibleIndex = result.ranking.findIndex((r) => !r.feasible);
    if (firstInfeasibleIndex !== -1) {
      expect(result.ranking.slice(firstInfeasibleIndex).every((r) => !r.feasible)).toBe(true);
    }
  });

  it('punktgleiche Formationen behalten die AVAILABLE_FORMATIONS-Reihenfolge', () => {
    // Alle Spieler identisch bewertet -> jede besetzbare Formation hat denselben Score
    // (score = req.GK*10 + req.DEF*10 + req.MID*10 + req.FWD*10 = 110 für alle, da 10 Feldspieler)
    const uniformPlayers: OptimizerPlayer[] = [];
    (['GK', 'DEF', 'MID', 'FWD'] as Position[]).forEach((position) => {
      for (let i = 0; i < 5; i++) {
        uniformPlayers.push(makePlayer({ id: `${position}${i}`, position, averagePoints: 10, valueScoreAvg: 10 }));
      }
    });
    const result = optimizeLineup(uniformPlayers, 'points');
    const feasible = result.ranking.filter((r) => r.feasible);
    expect(feasible.map((r) => r.formation)).toEqual(
      AVAILABLE_FORMATIONS.filter((f) => feasible.some((r) => r.formation === f)),
    );
  });

  it('scoreAverage entspricht score / 11', () => {
    const result = optimizeLineup(fullSquad(), 'valuePerMillion');
    expect(result.best?.scoreAverage).toBeCloseTo(result.best!.score! / 11, 10);
  });

  it('Marktwert 0 erzeugt kein Infinity oder NaN', () => {
    const players = fullSquad({ FWD: [{ marketValue: 0, valueScoreAvg: 0 }] });
    const result = optimizeLineup(players, 'valuePerMillion');
    expect(Number.isFinite(result.best?.score)).toBe(true);
  });

  it('ein Formationsstring, der nicht auf 11 Spieler summiert, ist immer nicht besetzbar', () => {
    // requiredCountsForFormation degradiert bei unparsbarem Input auf {GK:1,...:0}
    // (Summe 1) — auch bei einem übervollen Kader darf das nie eine "Optimalelf" ergeben.
    const players = fullSquad();
    const result = optimizeLineup(players, 'valuePerMillion', ['4-4-2', 'kaputt']);
    const broken = result.ranking.find((r) => r.formation === 'kaputt')!;
    expect(broken.feasible).toBe(false);
    expect(broken.score).toBeNull();
    expect(broken.playerIds).toEqual([]);
  });

  it('usedInAnyFormation enthält nur Spieler aus besetzbaren Formationen', () => {
    const players = squad({ DEF: 3 });
    const result = optimizeLineup(players, 'valuePerMillion');
    const feasibleIds = new Set(result.ranking.filter((r) => r.feasible).flatMap((r) => r.playerIds));
    expect(result.usedInAnyFormation).toEqual(feasibleIds);
  });
});
