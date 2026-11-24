import { describe, expect, it } from 'vitest';
import { mockLineupData } from '@/mock/mockLineup';
import { legalReplacements, readArchive, type MatchdaySnapshot } from './matchdayReview';

describe('Spieltagsrückblick', () => {
  const players = mockLineupData.players.map((p, i) => ({ ...p, teamId: String(i) }));
  const starters = players.filter((p) => p.inLineup);
  const snapshot: MatchdaySnapshot = { players, submitted: starters.map((p) => p.id), formation: mockLineupData.formation,
    day: 4, deadline: '2026-11-06T19:30:00Z', capturedAt: '2026-11-06T18:00:00Z',
    rules: [{ id: 'maxPerTeam', kind: 'maxPerTeam', max: 1, enabled: true }] };

  it('prüft Position und damalige Vereinsobergrenze gemeinsam', () => {
    const defender = starters.find((p) => p.position === 'DEF')!;
    const reserve = { ...players.find((p) => !p.inLineup && p.position === 'MID')!, teamId: defender.teamId };
    const swaps = legalReplacements(snapshot, starters, reserve);
    expect(swaps).toEqual([{ player: defender, formation: '3-4-3' }]);
  });

  it('liest den damaligen Kader einschließlich inzwischen verkaufter Spieler', () => {
    const stored = JSON.stringify([snapshot]);
    expect(readArchive(stored)[0].players.map((p) => p.id)).toEqual(players.map((p) => p.id));
    expect(readArchive('{"unvollständig":true}')).toEqual([]);
  });
});
