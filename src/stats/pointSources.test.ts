import { describe, expect, it } from 'vitest';
import type { MatchdayLineup, PointSource, StatsPlayerMeta } from './pointSources';
import {
  buildPointSources,
  groupByPosition,
  groupByTeam,
  MIN_APPEARANCES_FOR_AVERAGE,
  rankPointSources,
  totalPoints,
} from './pointSources';

function meta(entries: Record<string, Partial<StatsPlayerMeta>>): Map<string, StatsPlayerMeta> {
  return new Map(
    Object.entries(entries).map(([id, partial]) => [
      id,
      { name: id, teamId: 't1', position: 'MID', imageUrl: null, ...partial },
    ]),
  );
}

function points(entries: Record<string, Record<number, number>>): Map<string, Map<number, number>> {
  return new Map(
    Object.entries(entries).map(([id, days]) => [
      id,
      new Map(Object.entries(days).map(([day, value]) => [Number(day), value])),
    ]),
  );
}

const lineups: MatchdayLineup[] = [
  { day: 1, playerIds: ['keeper', 'star'] },
  { day: 2, playerIds: ['star', 'joker'] },
];

describe('buildPointSources', () => {
  it('zählt nur die Spieltage, an denen der Spieler in der eigenen Elf stand', () => {
    // 'star' holt an Spieltag 3 noch 99 Punkte — da stand er aber nicht in
    // meiner Elf, also gehören sie mir nicht.
    const sources = buildPointSources({
      lineups,
      pointsByPlayer: points({
        keeper: { 1: 4, 2: 10 },
        star: { 1: 30, 2: 20, 3: 99 },
        joker: { 2: 5 },
      }),
      meta: meta({ keeper: {}, star: {}, joker: {} }),
    });

    const byId = new Map(sources.map((source) => [source.playerId, source]));
    expect(byId.get('star')).toMatchObject({ points: 50, appearances: 2, averagePoints: 25 });
    expect(byId.get('keeper')).toMatchObject({ points: 4, appearances: 1 });
    expect(byId.get('joker')).toMatchObject({ points: 5, appearances: 1 });
  });

  it('zählt einen aufgestellten Spieler ohne Spieltagseintrag als Nuller-Einsatz', () => {
    const [source] = buildPointSources({
      lineups: [{ day: 1, playerIds: ['bank'] }, { day: 2, playerIds: ['bank'] }],
      // Kein Eintrag für Spieltag 2: aufgestellt, nicht gespielt.
      pointsByPlayer: points({ bank: { 1: 6 } }),
      meta: meta({ bank: {} }),
    });

    expect(source).toMatchObject({ points: 6, appearances: 2, averagePoints: 3 });
  });

  it('lässt Spieler ohne geladene Performance weg, statt 0 Punkte zu behaupten', () => {
    const sources = buildPointSources({
      lineups,
      pointsByPlayer: points({ star: { 1: 30, 2: 20 } }),
      meta: meta({ star: {} }),
    });

    expect(sources.map((source) => source.playerId)).toEqual(['star']);
  });

  it('benennt einen Spieler ohne Stammdaten nach seiner ID, statt ihn zu schlucken', () => {
    const [source] = buildPointSources({
      lineups: [{ day: 1, playerIds: ['4711'] }],
      pointsByPlayer: points({ '4711': { 1: 7 } }),
      meta: meta({}),
    });

    expect(source.name).toBe('Spieler 4711');
    expect(source.points).toBe(7);
  });
});

function source(partial: Partial<PointSource> & { playerId: string }): PointSource {
  return {
    name: partial.playerId,
    teamId: 't1',
    position: 'MID',
    imageUrl: null,
    points: 0,
    appearances: 0,
    averagePoints: 0,
    ...partial,
  };
}

describe('rankPointSources', () => {
  const rows = [
    source({ playerId: 'dauerläufer', points: 120, appearances: 10, averagePoints: 12 }),
    source({ playerId: 'eintagsfliege', points: 40, appearances: 1, averagePoints: 40 }),
    source({ playerId: 'konstant', points: 90, appearances: 5, averagePoints: 18 }),
  ];

  it('sortiert nach Gesamtpunkten', () => {
    expect(rankPointSources(rows, 'total').map((row) => row.playerId)).toEqual([
      'dauerläufer',
      'konstant',
      'eintagsfliege',
    ]);
  });

  it('lässt in der Ø-Wertung nur Spieler mit genug Einsätzen zu', () => {
    const ranked = rankPointSources(rows, 'average');
    expect(ranked.map((row) => row.playerId)).toEqual(['konstant', 'dauerläufer']);
    expect(rows.find((row) => row.playerId === 'eintagsfliege')!.appearances).toBeLessThan(
      MIN_APPEARANCES_FOR_AVERAGE,
    );
  });

  it('bricht Gleichstand stabil nach Einsätzen und Namen', () => {
    const tied = [
      source({ playerId: 'b', name: 'b', points: 10, appearances: 2 }),
      source({ playerId: 'a', name: 'a', points: 10, appearances: 2 }),
      source({ playerId: 'c', name: 'c', points: 10, appearances: 3 }),
    ];
    expect(rankPointSources(tied, 'total').map((row) => row.name)).toEqual(['c', 'a', 'b']);
  });

  it('lässt die Eingabe unangetastet', () => {
    const input = [source({ playerId: 'a', points: 1 }), source({ playerId: 'b', points: 2 })];
    rankPointSources(input, 'total');
    expect(input.map((row) => row.playerId)).toEqual(['a', 'b']);
  });
});

describe('Gruppierung', () => {
  const rows = [
    source({ playerId: 'p1', teamId: 'bvb', position: 'FWD', points: 100, appearances: 8 }),
    source({ playerId: 'p2', teamId: 'bvb', position: 'DEF', points: 40, appearances: 8 }),
    source({ playerId: 'p3', teamId: 'fcb', position: 'FWD', points: 90, appearances: 5 }),
  ];

  it('summiert Punkte je Verein und sortiert absteigend', () => {
    const groups = groupByTeam(rows, new Map([['bvb', 'Dortmund'], ['fcb', 'Bayern']]));
    expect(groups.map((group) => [group.label, group.points, group.playerCount])).toEqual([
      ['Dortmund', 140, 2],
      ['Bayern', 90, 1],
    ]);
    expect(groups[0].averagePoints).toBeCloseTo(140 / 16);
  });

  it('behält die Vereins-ID als Label, wenn der Name fehlt', () => {
    const [top] = groupByTeam(rows, new Map());
    expect(top.label).toBe('Verein bvb');
  });

  it('summiert Punkte je Position mit den Positionskürzeln der App', () => {
    expect(groupByPosition(rows).map((group) => [group.label, group.points])).toEqual([
      ['ANG', 190],
      ['ABW', 40],
    ]);
  });
});

describe('totalPoints', () => {
  it('summiert alle erfassten Punkte', () => {
    expect(totalPoints([source({ playerId: 'a', points: 12 }), source({ playerId: 'b', points: -3 })])).toBe(9);
  });
});
