import { describe, expect, it } from 'vitest';
import { EMPTY_PLAYER_FILTER, filterPlayers, isPlayerFilterActive } from './playerFilter';

interface TestPlayer {
  id: string;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  status: 'fit' | 'injured' | 'doubtful' | 'rehab' | 'suspended' | 'away' | 'unknown';
  teamId: string;
}

const players: TestPlayer[] = [
  { id: '1', name: 'Vincenzo Grifo', position: 'MID', status: 'fit', teamId: '5' },
  { id: '2', name: 'Harry Kane', position: 'FWD', status: 'injured', teamId: '2' },
  { id: '3', name: 'Manuel Neuer', position: 'GK', status: 'fit', teamId: '2' },
];

describe('isPlayerFilterActive', () => {
  it('ist inaktiv für den leeren Filter', () => {
    expect(isPlayerFilterActive(EMPTY_PLAYER_FILTER)).toBe(false);
  });
  it('ist aktiv, sobald irgendein Feld gesetzt ist', () => {
    expect(isPlayerFilterActive({ ...EMPTY_PLAYER_FILTER, query: 'kane' })).toBe(true);
    expect(isPlayerFilterActive({ ...EMPTY_PLAYER_FILTER, positions: ['GK'] })).toBe(true);
    expect(isPlayerFilterActive({ ...EMPTY_PLAYER_FILTER, statuses: ['injured'] })).toBe(true);
    expect(isPlayerFilterActive({ ...EMPTY_PLAYER_FILTER, teamIds: ['2'] })).toBe(true);
  });
  it('ignoriert reinen Leerraum in der Suche', () => {
    expect(isPlayerFilterActive({ ...EMPTY_PLAYER_FILTER, query: '   ' })).toBe(false);
  });
});

describe('filterPlayers', () => {
  it('lässt bei leerem Filter alle Spieler durch', () => {
    expect(filterPlayers(players, EMPTY_PLAYER_FILTER)).toEqual(players);
  });

  it('filtert die Suche groß-/kleinschreibungsunabhängig und über Teilstrings', () => {
    const result = filterPlayers(players, { ...EMPTY_PLAYER_FILTER, query: 'kane' });
    expect(result.map((p) => p.id)).toEqual(['2']);
  });

  it('filtert die Suche akzentunabhängig', () => {
    const result = filterPlayers(
      [{ id: '9', name: 'André Müller', position: 'MID', status: 'fit', teamId: '1' } as TestPlayer],
      { ...EMPTY_PLAYER_FILTER, query: 'muller' },
    );
    expect(result).toHaveLength(1);
  });

  it('kombiniert Positions- und Status-Filter (UND-Verknüpfung)', () => {
    const result = filterPlayers(players, {
      ...EMPTY_PLAYER_FILTER,
      positions: ['GK', 'FWD'],
      statuses: ['fit'],
    });
    // Kane ist FWD, aber verletzt — fliegt raus. Neuer ist GK und fit — bleibt.
    expect(result.map((p) => p.id)).toEqual(['3']);
  });

  it('filtert nach Verein', () => {
    const result = filterPlayers(players, { ...EMPTY_PLAYER_FILTER, teamIds: ['5'] });
    expect(result.map((p) => p.id)).toEqual(['1']);
  });

  it('liefert eine leere Liste, wenn nichts zum Filter passt, statt zu crashen', () => {
    expect(filterPlayers(players, { ...EMPTY_PLAYER_FILTER, query: 'niemand' })).toEqual([]);
  });
});
