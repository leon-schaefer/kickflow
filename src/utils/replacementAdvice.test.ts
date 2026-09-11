import { describe, expect, it } from 'vitest';
import type { Position } from '@/api/kickbase';
import { computeBudgetLimit } from './budget';
import type { OptimizerPlayer } from './lineupOptimizer';
import {
  describeReplacement,
  deriveReplacementAdvice,
  type ReplacementCandidatePlayer,
} from './replacementAdvice';

/**
 * Der Kern der Kaufempfehlung ist eine Messung, keine Heuristik: Zugewinn =
 * beste Elf mit ihm minus beste Elf ohne ihn. Genau das prüfen die Fälle hier
 * — insbesondere die drei, in denen eine naive „ist er besser als mein
 * Schlechtester"-Regel falsch läge: der Ausfall, den die Bank auffängt; der
 * Kandidat, der die Elf gar nicht anhebt; und der Kader, in dem ohne Zukauf
 * überhaupt keine Elf besetzbar ist.
 */
function makePlayer(
  overrides: Partial<OptimizerPlayer> & { id: string; position: Position },
): OptimizerPlayer {
  return {
    status: 'fit',
    teamId: 'T0',
    marketValue: 10_000_000,
    averagePoints: 0,
    valueScoreAvg: 0,
    ...overrides,
  };
}

function makeCandidate(
  overrides: Partial<ReplacementCandidatePlayer> & { id: string; position: Position },
): ReplacementCandidatePlayer {
  return {
    ...makePlayer(overrides),
    price: 10_000_000,
    isBotListing: true,
    offerCount: 0,
    expiresInSeconds: null,
    ownOfferPrice: null,
    ...overrides,
  };
}

/**
 * Kader mit 1 GK, 5 DEF, 5 MID, 5 FWD (jede Formation besetzbar), Spieler `i`
 * einer Position mit absteigenden Ø-Punkten — Vorbild: sellAdvice.test.ts.
 */
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

/**
 * Kader für die Regel-Tests: jeder Spieler bei einem EIGENEN Verein, damit die
 * Vereins-Obergrenze nur dort greift, wo der Test sie greifen lassen will —
 * bei MID0/MID1, die beide bei 'BAY' stehen und mit 100/99 Ø-Punkten die
 * Quote von 2 mit Spielern füllen, die stärker sind als jeder Kandidat.
 */
function squadWithFullTeamQuota(): OptimizerPlayer[] {
  const players = baseSquad({
    MID: [
      { averagePoints: 100, valueScoreAvg: 100 },
      { averagePoints: 99, valueScoreAvg: 99 },
    ],
  });
  return players.map((player) =>
    player.id === 'MID0' || player.id === 'MID1'
      ? { ...player, teamId: 'BAY' }
      : { ...player, teamId: `T-${player.id}` },
  );
}

function advise(
  players: OptimizerPlayer[],
  market: ReplacementCandidatePlayer[],
  overrides: {
    metric?: 'points' | 'valuePerMillion';
    /** Spielraum ohne offene Gebote — wird hier zu einem Limit mit genau diesem `available`. */
    available?: number | null;
  } = {},
) {
  return deriveReplacementAdvice({
    players,
    market,
    metric: overrides.metric ?? 'points',
    budget:
      overrides.available == null
        ? null
        : // Mannschaftswert 0 heißt kein Überziehungsrahmen: available === budget.
          computeBudgetLimit({ budget: overrides.available, teamValue: 0 }),
  });
}

describe('deriveReplacementAdvice — Ausfälle', () => {
  it('bepreist einen Ausfall mit dem, was die Elf mit ihm besser wäre', () => {
    // MID5 ist verletzt und mit 100 Ø-Punkten der klar Beste seiner Position;
    // ohne ihn spielt MID0 (10 Punkte) an seiner Stelle.
    const players = baseSquad(
      { MID: [{}, {}, {}, {}, {}, { averagePoints: 100, valueScoreAvg: 100, status: 'injured' }] },
      { MID: 6 },
    );
    const result = advise(players, []);

    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0]!.playerId).toBe('MID5');
    // Die 4-4-2-Elf spielt vier Mittelfeldspieler: statt MID3 (7 Punkte) würde
    // MID5 mit 100 spielen — der Verlust ist die Differenz, nicht seine Punkte.
    expect(result.gaps[0]!.loss).toBeGreaterThan(0);
    expect(result.totalLoss).toBe(result.gaps[0]!.loss);
  });

  it('bepreist einen Ausfall mit 0, wenn die Bank ihn auffängt', () => {
    // FWD4 ist der schwächste Stürmer und stünde in keiner Elf — sein Ausfall
    // kostet nichts. Eine „wer fehlt, muss ersetzt werden"-Regel läge hier falsch.
    const players = baseSquad({ FWD: [{}, {}, {}, {}, { status: 'injured' }] });
    const result = advise(players, []);

    expect(result.gaps.map((gap) => gap.playerId)).toEqual(['FWD4']);
    expect(result.gaps[0]!.loss).toBe(0);
    expect(result.gaps[0]!.breaksLineup).toBe(false);
  });

  it('meldet einen Ausfall, der die Elf unbesetzbar macht', () => {
    // Nur ein Torwart im Kader, und der ist verletzt.
    const players = baseSquad({ GK: [{ status: 'injured' }] });
    const result = advise(players, []);

    expect(result.baselineFeasible).toBe(false);
    expect(result.gaps[0]!.breaksLineup).toBe(true);
  });
});

describe('deriveReplacementAdvice — Kandidaten', () => {
  it('empfiehlt den Marktspieler, der die Elf am meisten anhebt', () => {
    const players = baseSquad({ MID: [{}, {}, {}, {}, { status: 'injured' }] });
    const market = [
      makeCandidate({ id: 'M-gut', position: 'MID', averagePoints: 50, valueScoreAvg: 5 }),
      makeCandidate({ id: 'M-mittel', position: 'MID', averagePoints: 20, valueScoreAvg: 2 }),
    ];
    const result = advise(players, market);

    expect(result.bestGainId).toBe('M-gut');
    expect(result.options[0]!.playerId).toBe('M-gut');
    expect(result.options[0]!.gain).toBeGreaterThan(result.options[1]!.gain);
  });

  it('nennt den effizientesten getrennt vom besten — zwei Antworten, zwei Spieler', () => {
    const players = baseSquad();
    const market = [
      // Viel Punkte, teuer erkauft.
      makeCandidate({
        id: 'M-teuer',
        position: 'MID',
        averagePoints: 50,
        marketValue: 40_000_000,
        price: 40_000_000,
      }),
      // Weniger Punkte, aber für einen Bruchteil.
      makeCandidate({
        id: 'M-billig',
        position: 'MID',
        averagePoints: 20,
        marketValue: 2_000_000,
        price: 2_000_000,
      }),
    ];
    const result = advise(players, market);

    expect(result.bestGainId).toBe('M-teuer');
    expect(result.bestEfficiencyId).toBe('M-billig');
  });

  it('sortiert bei der Effizienz-Metrik nach Zugewinn je Mio', () => {
    const players = baseSquad();
    const market = [
      makeCandidate({
        id: 'M-teuer',
        position: 'MID',
        averagePoints: 50,
        marketValue: 40_000_000,
        price: 40_000_000,
      }),
      makeCandidate({
        id: 'M-billig',
        position: 'MID',
        averagePoints: 20,
        marketValue: 2_000_000,
        price: 2_000_000,
      }),
    ];

    expect(advise(players, market, { metric: 'points' }).options[0]!.playerId).toBe('M-teuer');
    expect(advise(players, market, { metric: 'valuePerMillion' }).options[0]!.playerId).toBe(
      'M-billig',
    );
  });

  it('lässt Kandidaten weg, die die Elf nicht anheben', () => {
    // Der Kader spielt im Mittelfeld 10..6 Punkte; ein Spieler mit 1 Punkt
    // käme in keiner Formation in die Elf.
    const players = baseSquad();
    const market = [makeCandidate({ id: 'M-schwach', position: 'MID', averagePoints: 1 })];
    const result = advise(players, market);

    expect(result.options).toHaveLength(0);
    expect(result.consideredCount).toBe(1);
    expect(result.bestGainId).toBeNull();
  });

  it('prüft ausgefallene Kandidaten und eigene Listings gar nicht', () => {
    const players = baseSquad();
    const market = [
      makeCandidate({ id: 'M-verletzt', position: 'MID', averagePoints: 99, status: 'injured' }),
      // Eigener, auf den Markt gestellter Spieler — steht im Markt UND im Kader.
      makeCandidate({ id: 'MID0', position: 'MID', averagePoints: 99 }),
    ];
    const result = advise(players, market);

    expect(result.consideredCount).toBe(0);
    expect(result.options).toHaveLength(0);
  });

  it('erkennt den direkten Ersatz für einen Ausfall an der Position', () => {
    // DEF0 ist der stärkste Verteidiger — sein Ausfall kostet die Elf Punkte.
    const players = baseSquad({ DEF: [{ status: 'injured' }] });
    const market = [makeCandidate({ id: 'D-neu', position: 'DEF', averagePoints: 50 })];
    const result = advise(players, market);

    expect(result.options[0]!.coversGapPlayerIds).toEqual(['DEF0']);
  });

  it('nennt einen folgenlosen Ausfall NICHT als zu ersetzen', () => {
    // DEF4 ist der schwächste Verteidiger; in einer 3er-Kette stünde er nie in
    // der Elf. Ein neuer Verteidiger ersetzt ihn nicht — er verstärkt die Elf.
    const players = baseSquad({ DEF: [{}, {}, {}, {}, { status: 'injured' }] });
    const market = [makeCandidate({ id: 'D-neu', position: 'DEF', averagePoints: 50 })];
    const result = advise(players, market);

    expect(result.gaps[0]!.loss).toBe(0);
    expect(result.options[0]!.coversGapPlayerIds).toEqual([]);
  });

  it('nennt den Verdrängten, wenn kein Ausfall im Spiel ist', () => {
    const players = baseSquad();
    const market = [makeCandidate({ id: 'F-neu', position: 'FWD', averagePoints: 50 })];
    const result = advise(players, market);

    expect(result.options[0]!.coversGapPlayerIds).toEqual([]);
    expect(result.options[0]!.replacesPlayerIds.length).toBeGreaterThan(0);
  });

  it('zeigt bei unbesetzbarer Elf den Kandidaten, der sie möglich macht', () => {
    const players = baseSquad({ GK: [{ status: 'injured' }] });
    const market = [makeCandidate({ id: 'G-neu', position: 'GK', averagePoints: 5 })];
    const result = advise(players, market);

    expect(result.baselineFeasible).toBe(false);
    expect(result.options[0]!.playerId).toBe('G-neu');
    expect(result.options[0]!.enablesLineup).toBe(true);
    // Ohne Bezugself ist der „Zugewinn" der Punktwert der ganzen Elf.
    expect(result.options[0]!.gain).toBeGreaterThan(0);
  });

  it('respektiert die Vereins-Obergrenze — ein Spieler, der nicht spielen darf, bringt nichts', () => {
    // Alle im Mittelfeld bei T0; der Kandidat wäre der dritte T0-Spieler in der
    // Elf und damit unter max. 2 pro Verein nicht aufstellbar.
    const players = baseSquad();
    const market = [makeCandidate({ id: 'M-neu', position: 'MID', averagePoints: 50, teamId: 'T0' })];

    const unconstrained = deriveReplacementAdvice({ players, market, metric: 'points' });
    const constrained = deriveReplacementAdvice({
      players,
      market,
      metric: 'points',
      constraints: { maxPerTeam: 2 },
    });

    expect(unconstrained.options).toHaveLength(1);
    expect(constrained.options.some((option) => option.playerId === 'M-neu')).toBe(false);
  });

  /**
   * Der realistische Fall: ein Kader mit Spielern aus vielen Vereinen, davon
   * zwei vom selben — und die zwei sind BESSER als jeder Kandidat. Nur dann
   * ist ein dritter Spieler dieses Vereins wirklich blockiert. Gegen zwei
   * schwache Vereinskollegen wäre er es NICHT: der Optimizer verdrängt dann
   * einfach einen von ihnen, und die Regel ist gar nicht das Hindernis. (Erste
   * Fassung dieses Tests lag genau daran falsch.)
   */
  it('empfiehlt bei voller Vereinsquote den Spieler eines anderen Vereins', () => {
    const players = squadWithFullTeamQuota();
    const market = [
      makeCandidate({ id: 'BAY-neu', position: 'MID', averagePoints: 50, teamId: 'BAY' }),
      makeCandidate({ id: 'BVB-neu', position: 'MID', averagePoints: 50, teamId: 'BVB' }),
    ];
    const constraints = { maxPerTeam: 2 };

    const result = deriveReplacementAdvice({ players, market, metric: 'points', constraints });

    expect(result.options.map((option) => option.playerId)).toEqual(['BVB-neu']);
    // Ohne die Regel wären beide gleich gut — sie ist der ganze Unterschied.
    const open = deriveReplacementAdvice({ players, market, metric: 'points' });
    expect(open.options.map((option) => option.playerId).sort()).toEqual(['BAY-neu', 'BVB-neu']);
  });

  it('benennt den von der Regel geblockten Kandidaten samt entgangenem Zugewinn', () => {
    const players = squadWithFullTeamQuota();
    const market = [makeCandidate({ id: 'BAY-neu', position: 'MID', averagePoints: 50, teamId: 'BAY' })];

    const result = deriveReplacementAdvice({
      players,
      market,
      metric: 'points',
      constraints: { maxPerTeam: 2 },
    });

    expect(result.options).toHaveLength(0);
    expect(result.blockedByRule).toHaveLength(1);
    expect(result.blockedByRule[0]!.playerId).toBe('BAY-neu');
    expect(result.blockedByRule[0]!.blockedByRuleIds).toEqual(['maxPerTeam']);
    // Genau der Zugewinn, den die unbeschränkte Rechnung für ihn ausweist —
    // die Zahl, die die Regel den Nutzer kostet.
    const open = deriveReplacementAdvice({ players, market, metric: 'points' });
    expect(result.blockedByRule[0]!.gainWithoutRule).toBe(open.options[0]!.gain);
    expect(result.blockedByRule[0]!.gainWithoutRule).toBeGreaterThan(0);
  });

  it('nennt einen schwachen Kandidaten NICHT als von der Regel geblockt', () => {
    // Er käme auch ohne Regel in keine Elf — die Regel ist nicht sein Problem.
    const players = squadWithFullTeamQuota();
    const market = [
      makeCandidate({ id: 'BAY-schwach', position: 'MID', averagePoints: 1, teamId: 'BAY' }),
    ];

    const result = deriveReplacementAdvice({
      players,
      market,
      metric: 'points',
      constraints: { maxPerTeam: 2 },
    });

    expect(result.options).toHaveLength(0);
    expect(result.blockedByRule).toHaveLength(0);
  });

  it('sortiert die Geblockten nach dem, was sie ohne die Regel gebracht hätten', () => {
    const players = squadWithFullTeamQuota();
    const market = [
      makeCandidate({ id: 'BAY-mittel', position: 'MID', averagePoints: 40, teamId: 'BAY' }),
      makeCandidate({ id: 'BAY-stark', position: 'MID', averagePoints: 60, teamId: 'BAY' }),
    ];

    const result = deriveReplacementAdvice({
      players,
      market,
      metric: 'points',
      constraints: { maxPerTeam: 2 },
    });

    expect(result.blockedByRule.map((entry) => entry.playerId)).toEqual([
      'BAY-stark',
      'BAY-mittel',
    ]);
  });

  it('meldet ohne aktive Regel nie eine Blockade', () => {
    const players = baseSquad();
    const market = [makeCandidate({ id: 'M-schwach', position: 'MID', averagePoints: 1 })];

    expect(advise(players, market).blockedByRule).toEqual([]);
  });

  it('reicht den Budgetrahmen an die Gebotsempfehlung durch', () => {
    const players = baseSquad();
    const market = [
      makeCandidate({
        id: 'M-neu',
        position: 'MID',
        averagePoints: 50,
        marketValue: 20_000_000,
        price: 20_000_000,
      }),
    ];
    const result = advise(players, market, { available: 1_000_000 });

    expect(result.options[0]!.bid.verdict).toBe('kein-budget');
    expect(result.options[0]!.bid.bid).toBeNull();
    // Die Effizienz rechnet weiter mit dem echten Preis, nicht mit dem
    // gekürzten Gebot — sonst stünde ein unbezahlbarer Spieler oben.
    expect(result.options[0]!.cost).toBe(20_000_000);
  });

  it('gibt für einen Spieler mit eigenem Gebot dessen Betrag im Rahmen wieder frei', () => {
    const players = baseSquad();
    const candidate = makeCandidate({
      id: 'M-neu',
      position: 'MID',
      averagePoints: 50,
      marketValue: 20_000_000,
      price: 20_000_000,
    });
    // 21 Mio Konto, davon 20 Mio durch das eigene Gebot auf GENAU diesen
    // Spieler gebunden. Ohne die Freigabe hieße es „kein Budget" — für ein
    // Gebot, das längst angenommen ist.
    const budget = computeBudgetLimit({ budget: 21_000_000, teamValue: 0, pendingOffers: 20_000_000 });
    expect(budget.available).toBe(1_000_000);

    const without = deriveReplacementAdvice({ players, market: [candidate], metric: 'points', budget });
    expect(without.options[0]!.bid.verdict).toBe('kein-budget');

    const withOwn = deriveReplacementAdvice({
      players,
      market: [{ ...candidate, offerCount: 1, ownOfferPrice: 20_000_000 }],
      metric: 'points',
      budget,
    });
    expect(withOwn.options[0]!.bid.verdict).not.toBe('kein-budget');
    expect(withOwn.options[0]!.bid.bid).toBe(20_600_000);
  });

  it('leitet die Wertobergrenze aus der Elf ab, nicht aus dem ganzen Kader', () => {
    // Elf-Median der Ø-Punkte/Mio liegt bei den Startelf-Spielern; die
    // schwachen Bankspieler dürfen ihn nicht drücken.
    const players = baseSquad({}, { MID: 12 });
    const result = advise(players, []);
    expect(result.referenceValueScore).toBeGreaterThan(0);
  });
});

describe('describeReplacement', () => {
  const base = {
    playerId: 'X',
    gain: 5,
    gainPerMillion: 1,
    cost: 5_000_000,
    bid: {} as never,
    formation: '4-4-2',
    replacesPlayerIds: [],
    coversGapPlayerIds: [],
    enablesLineup: false,
  };
  const names = (id: string) => ({ A: 'Anton', B: 'Berta' })[id];

  it('nennt die unbesetzbare Elf zuerst — sie ist die dringendste Aussage', () => {
    expect(
      describeReplacement({ ...base, enablesLineup: true, coversGapPlayerIds: ['A'] }, names),
    ).toContain('besetzbar');
  });

  it('nennt den Ausfall, den er direkt ersetzt', () => {
    expect(describeReplacement({ ...base, coversGapPlayerIds: ['A'] }, names)).toContain('Anton');
  });

  it('nennt den Verdrängten', () => {
    expect(describeReplacement({ ...base, replacesPlayerIds: ['B'] }, names)).toBe(
      'Kommt für Berta in die Elf.',
    );
  });

  it('fällt bei unbekannter ID auf die allgemeine Formulierung zurück statt eine ID zu zeigen', () => {
    const text = describeReplacement({ ...base, replacesPlayerIds: ['unbekannt'] }, names);
    expect(text).not.toContain('unbekannt');
    expect(text).toBe('Hebt die Elf an, ohne einen Ausfall zu ersetzen.');
  });
});
