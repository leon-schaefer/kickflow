import { describe, expect, it } from 'vitest';
import { countByPosition, countByTeam } from './teamDistribution';

describe('countByTeam', () => {
  const teamNames = new Map([
    ['5', 'Freiburg'],
    ['9', 'Stuttgart'],
  ]);

  it('zählt Spieler je Verein, absteigend nach Anzahl', () => {
    const players = [{ teamId: '5' }, { teamId: '5' }, { teamId: '9' }];
    expect(countByTeam(players, teamNames)).toEqual([
      { teamId: '5', name: 'Freiburg', count: 2 },
      { teamId: '9', name: 'Stuttgart', count: 1 },
    ]);
  });

  it('fällt auf die Vereins-ID zurück, wenn der Name unbekannt ist', () => {
    expect(countByTeam([{ teamId: '77' }], teamNames)).toEqual([{ teamId: '77', name: '77', count: 1 }]);
  });

  it('sortiert bei Gleichstand alphabetisch nach Namen', () => {
    const players = [{ teamId: '9' }, { teamId: '5' }];
    expect(countByTeam(players, teamNames).map((r) => r.teamId)).toEqual(['5', '9']);
  });

  it('liefert eine leere Liste für einen leeren Kader statt zu crashen', () => {
    expect(countByTeam([], teamNames)).toEqual([]);
  });
});

describe('countByPosition', () => {
  it('zählt Spieler je Position, in fester Reihenfolge GK→DEF→MID→FWD', () => {
    const players = [
      { position: 'FWD' as const },
      { position: 'GK' as const },
      { position: 'FWD' as const },
      { position: 'MID' as const },
    ];
    expect(countByPosition(players)).toEqual([
      { position: 'GK', count: 1 },
      { position: 'MID', count: 1 },
      { position: 'FWD', count: 2 },
    ]);
  });

  it('lässt Positionen ohne Spieler aus, statt sie mit 0 zu listen', () => {
    expect(countByPosition([{ position: 'GK' as const }])).toEqual([{ position: 'GK', count: 1 }]);
  });

  it('liefert eine leere Liste ohne Spieler', () => {
    expect(countByPosition([])).toEqual([]);
  });
});
