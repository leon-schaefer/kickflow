import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { playerDetail } from '@/test/playerDetail';
import { DuelFixtures } from './DuelFixtures';

const ranking = vi.hoisted(() => ({ day: 7, entries: [
  { userId: 'me', lineupPlayerIds: ['a', 'b'] }, { userId: 'you', userName: 'Gast', lineupPlayerIds: [] },
] }));
vi.mock('@/queries/hooks', () => ({
  useLeagueRanking: () => ({ data: ranking }),
  useManagerLineup: () => ({ players: new Map([['a', playerDetail({ teamId: 'home' })]]) }),
}));

it('zählt nur sichtbare Spieler mit künftigem Anstoß am angefragten Spieltag', () => {
  const kickoffAt = '2026-11-01T16:00:00Z';
  const day = { day: 7, firstKickoff: null, allPlayed: false, fixtures: [{ homeTeamId: 'home',
    awayTeamId: 'away', kickoffAt, hasResult: false, homeGoals: null, awayGoals: null, homeLogoUrl: null, awayLogoUrl: null }] };
  const element = (time: number) => <DuelFixtures day={day} leagueId="l" ownId="me" opponentId="you" now={time} />;
  const view = render(element(Date.parse(kickoffAt) - 1));
  expect(screen.getByText('Du · 1 vor Anstoß · 1 ungeklärt')).toBeVisible();
  expect(screen.getByText('Gast · Startelf noch nicht sichtbar')).toBeVisible();
  view.rerender(element(Date.parse(kickoffAt)));
  expect(screen.getByText('Du · 0 vor Anstoß · 1 ungeklärt')).toBeVisible();
  ranking.day = 6;
  view.rerender(element(Date.parse(kickoffAt)));
  expect(screen.queryByText(/vor Anstoß/)).toBeNull();
});
