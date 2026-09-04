import { describe, expect, it } from 'vitest';
import type { Position } from '@/api/kickbase';
import { formatCurrency } from './format';
import { optimizeLineup, type OptimizerPlayer } from './lineupOptimizer';
import { deriveSellAdvice } from './sellAdvice';
import { buildSellPlan } from './sellPlan';

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

function advice(players: OptimizerPlayer[], forcedSaleIds: string[] = []) {
  const efficiency = optimizeLineup(players, 'valuePerMillion');
  const points = optimizeLineup(players, 'points');
  return deriveSellAdvice(players, efficiency, points, forcedSaleIds);
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
    for (const forced of [[], ['FWD0', 'MID3']]) {
      const result = advice(players, forced);
      expect(result.length).toBe(players.length);
      expect(new Set(result.map((e) => e.playerId)).size).toBe(players.length);
    }
  });
});

describe('deriveSellAdvice mit Pflichtverkäufen (negatives Konto)', () => {
  it('ohne Pflichtverkäufe bleibt die Einordnung unverändert', () => {
    const players = baseSquad();
    expect(advice(players, [])).toEqual(advice(players));
    expect(advice(players, []).some((e) => e.recommendation === 'pflichtverkauf')).toBe(false);
  });

  it('Pflichtverkauf schlägt "unverzichtbar"', () => {
    const players = baseSquad();
    // FWD0 steht (siehe erster Test oben) in beiden Optimal-Elfen.
    const result = advice(players, ['FWD0']);
    const entry = findAdvice(result, 'FWD0');
    expect(entry.recommendation).toBe('pflichtverkauf');
    expect(entry.inBestPointsXi).toBe(true);
    expect(entry.reason).toContain('Stammplatz');
    expect(entry.reason).toContain(formatCurrency(players.find((p) => p.id === 'FWD0')!.marketValue));
  });

  it('Pflichtverkauf schlägt auch "nicht-einsatzbereit"', () => {
    // Genau der Kader aus dem Ausfall-Test oben — der Plan verkauft nicht
    // einsatzfähige Spieler zuerst, dieser Fall ist also der häufigste.
    const players = baseSquad({
      FWD: [{ status: 'injured', marketValue: 90_000_000, valueScoreAvg: 1000, averagePoints: 1000 }],
    });
    expect(findAdvice(advice(players), 'FWD0').recommendation).toBe('nicht-einsatzbereit');
    expect(findAdvice(advice(players, ['FWD0']), 'FWD0').recommendation).toBe('pflichtverkauf');
  });

  it('Pflichtverkäufe stehen ganz oben, in Planreihenfolge statt nach Marktwert', () => {
    const players = baseSquad({ FWD: [{}, { marketValue: 80_000_000 }, {}, { marketValue: 5_000_000 }] });
    // FWD3 ist der günstigere — die Marktwert-Sortierung würde FWD1 vorziehen.
    const result = advice(players, ['FWD3', 'FWD1']);
    expect(result.slice(0, 2).map((e) => e.playerId)).toEqual(['FWD3', 'FWD1']);
    expect(result.slice(0, 2).every((e) => e.recommendation === 'pflichtverkauf')).toBe(true);
  });

  it('ignoriert IDs, die nicht im Kader stehen', () => {
    const players = baseSquad();
    const result = advice(players, ['GHOST']);
    expect(result.length).toBe(players.length);
    expect(result.some((e) => e.recommendation === 'pflichtverkauf')).toBe(false);
  });

  it('übernimmt den Plan von buildSellPlan (Verdrahtung End-to-End)', () => {
    // "Hlozek"-Kader aus sellPlan.test.ts: einzige Freiheit ist FWD, und nur
    // FWD0 deckt die 55 Mio — obwohl er in der Optimal-Elf steht.
    const players: OptimizerPlayer[] = [
      makePlayer({ id: 'GK0', position: 'GK', averagePoints: 5, valueScoreAvg: 5, marketValue: 5_000_000 }),
      ...['DEF0', 'DEF1', 'DEF2', 'DEF3'].map((id) =>
        makePlayer({ id, position: 'DEF', averagePoints: 5, valueScoreAvg: 5, marketValue: 10_000_000 }),
      ),
      ...['MID0', 'MID1', 'MID2', 'MID3'].map((id) =>
        makePlayer({ id, position: 'MID', averagePoints: 5, valueScoreAvg: 5, marketValue: 10_000_000 }),
      ),
      makePlayer({ id: 'FWD0', position: 'FWD', averagePoints: 8, valueScoreAvg: 8, marketValue: 60_000_000 }),
      makePlayer({ id: 'FWD1', position: 'FWD', averagePoints: 6, valueScoreAvg: 6, marketValue: 10_000_000 }),
      makePlayer({ id: 'FWDBench', position: 'FWD', averagePoints: 1, valueScoreAvg: 1, marketValue: 2_000_000 }),
    ];
    const plan = buildSellPlan(players, 'points', 55_000_000, ['4-4-2']);
    const forcedSaleIds = plan.sell.map((entry) => entry.playerId);
    expect(forcedSaleIds).toEqual(['FWD0']);

    const efficiency = optimizeLineup(players, 'valuePerMillion', ['4-4-2']);
    const points = optimizeLineup(players, 'points', ['4-4-2']);
    expect(findAdvice(deriveSellAdvice(players, efficiency, points), 'FWD0').recommendation).toBe('unverzichtbar');

    const withPlan = deriveSellAdvice(players, efficiency, points, forcedSaleIds);
    expect(findAdvice(withPlan, 'FWD0').recommendation).toBe('pflichtverkauf');
    expect(withPlan[0]!.playerId).toBe('FWD0');
  });
});

describe('deriveSellAdvice mit vom Verkauf ausgeschlossenen Spielern', () => {
  function adviceWithExclusions(players: OptimizerPlayer[], excludedIds: string[], forcedSaleIds: string[] = []) {
    const efficiency = optimizeLineup(players, 'valuePerMillion');
    const points = optimizeLineup(players, 'points');
    return deriveSellAdvice(players, efficiency, points, forcedSaleIds, new Set(excludedIds));
  }

  it('ohne Ausschlüsse bleibt die Einordnung unverändert', () => {
    const players = baseSquad();
    expect(adviceWithExclusions(players, [])).toEqual(advice(players));
    expect(advice(players).every((e) => e.excluded === false)).toBe(true);
  });

  it('macht aus "verkaufen" ein "ausgeschlossen" und behält die Begründung', () => {
    const players = baseSquad({ FWD: [{}, {}, {}, {}, {}, { marketValue: 90_000_000 }] }, { FWD: 6 });
    expect(findAdvice(advice(players), 'FWD5').recommendation).toBe('verkaufen');

    const entry = findAdvice(adviceWithExclusions(players, ['FWD5']), 'FWD5');
    expect(entry.recommendation).toBe('ausgeschlossen');
    expect(entry.excluded).toBe(true);
    expect(entry.reason).toContain('Vom Verkauf ausgeschlossen');
    // Die sportliche Einordnung geht nicht verloren.
    expect(entry.reason).toContain('In keiner Formation in der Elf');
  });

  it('schlägt einen ausgeschlossenen Spieler auch dann nicht vor, wenn er im Plan steht', () => {
    // Widersprüchliche Eingabe (buildSellPlan liefert das nie): der Ausschluss
    // muss trotzdem gewinnen — nichts darf einen Pflichtverkauf daraus machen.
    const players = baseSquad();
    const result = adviceWithExclusions(players, ['FWD0'], ['FWD0']);
    expect(findAdvice(result, 'FWD0').recommendation).toBe('ausgeschlossen');
    expect(result.some((e) => e.recommendation === 'pflichtverkauf')).toBe(false);
  });

  it('sortiert Ausgeschlossene ans Ende — sie sind keine offene Entscheidung mehr', () => {
    const players = baseSquad({ FWD: [{}, {}, {}, {}, {}, { marketValue: 90_000_000 }] }, { FWD: 6 });
    const result = adviceWithExclusions(players, ['FWD5']);
    expect(result[result.length - 1]!.playerId).toBe('FWD5');
    expect(result.length).toBe(players.length);
  });

  it('lässt die Einordnung der übrigen Spieler unberührt', () => {
    const players = baseSquad({ FWD: [{}, {}, {}, {}, {}, { marketValue: 90_000_000 }] }, { FWD: 6 });
    const withExclusion = adviceWithExclusions(players, ['FWD5']);
    for (const entry of advice(players)) {
      if (entry.playerId === 'FWD5') continue;
      expect(findAdvice(withExclusion, entry.playerId)).toEqual({ ...entry, excluded: false });
    }
  });
});
