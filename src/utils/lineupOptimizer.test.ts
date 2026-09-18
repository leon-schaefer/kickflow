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

  it('füllt mit dem verletzten Torwart auf, statt keine Formation zuzulassen', () => {
    // Der einzige Torwart ist verletzt. Ohne Auffüllen wäre keine Formation
    // besetzbar und der ganze Optimizer stumm — stattdessen steht er als
    // Auffüller im Tor und zählt 0, die zehn Feldspieler werden optimiert.
    const fit = optimizeLineup(fullSquad(), 'valuePerMillion');
    const players = fullSquad().map((p) => (p.position === 'GK' ? { ...p, status: 'injured' as const } : p));
    const result = optimizeLineup(players, 'valuePerMillion');

    expect(result.best).not.toBeNull();
    expect(result.best!.formation).toBe(fit.best!.formation);
    expect(result.best!.playerIds).toEqual(fit.best!.playerIds);
    expect(result.best!.fillerIds).toEqual(['GK0']);
    // Genau die 10 Ø-Punkte/Mio des Torwarts fehlen — er bringt als Auffüller nichts.
    expect(result.best!.score).toBe(fit.best!.score! - 10);
    expect(result.ranking.every((r) => !r.feasible || r.fillerIds.length === 1)).toBe(true);
    // Er bleibt trotzdem als nicht einsatzfähig gelistet.
    expect(result.excludedPlayerIds).toEqual(['GK0']);
  });

  it('füllt nur auf, wenn kein einsatzfähiger Spieler mehr übrig ist — auch bei negativem Schnitt', () => {
    // 0 > -5, trotzdem spielt der fitte Torwart: der Optimizer stellt nie
    // freiwillig jemanden auf, der nicht spielen kann (Regel 2 der Modul-Doku).
    const players = squad(
      { GK: 2 },
      { GK: [{ averagePoints: -5, valueScoreAvg: -5 }, { status: 'injured', averagePoints: 100, valueScoreAvg: 100 }] },
    );
    const result = optimizeLineup(players, 'points');
    expect(result.best!.playerIds).toContain('GK0');
    expect(result.best!.playerIds).not.toContain('GK1');
    expect(result.best!.fillerIds).toEqual([]);
  });

  /**
   * 3 fitte + 1 verletzter Verteidiger, nur 4 Mittelfeldspieler (zwei davon
   * mit 0), fünf gleich starke Stürmer. Ohne Auffüller ist einzig 3-4-3
   * besetzbar; 4-2-4 mit dem Verletzten in der Abwehr summiert über seine
   * zehn Einsatzfähigen MEHR (zwei 0er-Mittelfeldspieler weniger, zwei
   * 10er-Stürmer mehr) — und darf trotzdem nicht gewinnen.
   */
  const tieredSquad = () =>
    squad(
      { DEF: 4, MID: 4 },
      {
        DEF: [{}, {}, {}, { status: 'injured' }],
        MID: [
          { averagePoints: 10, valueScoreAvg: 10 },
          { averagePoints: 9, valueScoreAvg: 9 },
          { averagePoints: 0, valueScoreAvg: 0 },
          { averagePoints: 0, valueScoreAvg: 0 },
        ],
        FWD: Array.from({ length: 5 }, () => ({ averagePoints: 10, valueScoreAvg: 10 })),
      },
    );

  it('eine Formation ohne Ausfall schlägt jede mit Ausfall, auch eine punktstärkere', () => {
    const result = optimizeLineup(tieredSquad(), 'points');
    const byFormation = new Map(result.ranking.map((r) => [r.formation, r]));
    const fit = byFormation.get('3-4-3')!;
    const filled = byFormation.get('4-2-4')!;

    expect(filled.feasible).toBe(true);
    expect(filled.fillerIds).toEqual(['DEF3']);
    expect(filled.score!).toBeGreaterThan(fit.score!);
    expect(result.best!.formation).toBe('3-4-3');
    expect(result.best!.fillerIds).toEqual([]);
    // Alle Formationen ohne Ausfall vor allen mit Ausfall, innerhalb der Stufe nach Score.
    const feasible = result.ranking.filter((r) => r.feasible);
    expect(feasible.map((r) => r.formation)).toEqual(['3-4-3', '4-2-4', '4-3-3', '4-4-2']);
  });

  it('Auffüller stehen innerhalb ihrer Position hinter allen Einsatzfähigen', () => {
    const result = optimizeLineup(tieredSquad(), 'points');
    const filled = result.ranking.find((r) => r.formation === '4-4-2')!;
    expect(filled.playerIds.slice(0, 5)).toEqual(['GK0', 'DEF0', 'DEF1', 'DEF2', 'DEF3']);
    expect(filled.fillerIds.every((id) => filled.playerIds.includes(id))).toBe(true);
  });

  it('usedInAnyFormation zählt nur Formationen der besten Stufe', () => {
    // 4-2-4 bräuchte den Verletzten und kommt nie zum Zug — FWD3 stünde nur
    // dort, DEF3 ist der Auffüller: beide gelten nicht als "irgendwo gebraucht".
    const result = optimizeLineup(tieredSquad(), 'points');
    expect(result.usedInAnyFormation).toEqual(new Set(result.best!.playerIds));
    expect(result.usedInAnyFormation.has('FWD3')).toBe(false);
    expect(result.usedInAnyFormation.has('DEF3')).toBe(false);
  });

  it('`missing` ist, was auch mit Auffüllern noch fehlt', () => {
    const result = optimizeLineup(tieredSquad(), 'points');
    const byFormation = new Map(result.ranking.map((r) => [r.formation, r]));
    // 5er-Kette: 3 fitte + 1 verletzter Verteidiger, es fehlt noch einer.
    expect(byFormation.get('5-3-2')!.feasible).toBe(false);
    expect(byFormation.get('5-3-2')!.missing).toEqual({ DEF: 1 });
    // 4er-Kette geht — mit dem Verletzten.
    expect(byFormation.get('4-4-2')!.missing).toEqual({});
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
