import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { MatchdayPerformance } from '@/api/kickbase';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import { marketPlayer } from '@/test/marketPlayer';
import { playerDetail } from '@/test/playerDetail';
import { PlayerComparison } from './PlayerComparison';

vi.mock('@/queries/hooks', () => ({ usePlayer: () => ({ data: playerDetail({ id: '2', name: 'Gast' }) }) }));

it('unterscheidet am selben Spieltag einen belegten Nicht-Einsatz von einer fehlenden Historie', () => {
  const kickoffAt = '2025-11-01T15:30:00Z';
  const fixture = { homeTeamId: 'a', awayTeamId: 'b', homeLogoUrl: null, awayLogoUrl: null,
    hasResult: true, homeGoals: 1, awayGoals: 0, kickoffAt };
  const match: MatchdayPerformance = { ...fixture, homeLogoUrl: '', awayLogoUrl: '', matchday: 1,
    matchDate: kickoffAt, playerTeamId: 'a', points: 0, minutesPlayed: 0, seasonAveragePoints: null,
    seasonTotalPoints: 0, isCurrent: false };
  const first = playerDetail({ performance: [{ title: '2025', leagueName: 'Liga', matchdays: [match] }] });
  render(<LeagueIdProvider id="liga"><PlayerComparison first={first} squad={[]}
    market={[marketPlayer({ id: '2', name: 'Gast' })]} teamNames={new Map()}
    schedule={{ currentDay: 1, matchdays: [{ day: 1, allPlayed: true, firstKickoff: kickoffAt, fixtures: [fixture] }] }} />
  </LeagueIdProvider>);
  fireEvent.click(screen.getByText('Spieler vergleichen'));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
  expect(screen.getByText('Ohne Einsatz')).toBeVisible();
  expect(screen.getByText('Keine Daten')).toBeVisible();
});
