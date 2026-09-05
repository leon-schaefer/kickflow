import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MatchdayPerformance } from '@/api/kickbase';
import { MatchdayRow } from './MatchdayRow';

function makeMatchday(overrides: Partial<MatchdayPerformance> = {}): MatchdayPerformance {
  return {
    matchday: 3,
    matchDate: '2026-08-22T18:30:00Z',
    homeTeamId: '2',
    awayTeamId: '7',
    homeGoals: 3,
    awayGoals: 1,
    homeLogoUrl: 'https://kickbase.test/fcb.svg',
    awayLogoUrl: 'https://kickbase.test/bvb.svg',
    playerTeamId: '2',
    hasResult: true,
    points: 142,
    seasonAveragePoints: 120,
    seasonTotalPoints: 400,
    minutesPlayed: 90,
    isCurrent: false,
    ...overrides,
  };
}

const teamNames = new Map([
  ['2', 'FC Bayern'],
  ['7', 'Dortmund'],
]);

describe('MatchdayRow', () => {
  it('zeigt die Paarung aus Spielersicht — Heim, Gegner, eigenes Ergebnis zuerst', () => {
    render(<MatchdayRow matchday={makeMatchday()} playerTeamId="2" teamNames={teamNames} />);

    expect(screen.getByText('ST 3')).toBeInTheDocument();
    expect(screen.getByText('H')).toBeInTheDocument();
    expect(screen.getByText('Dortmund')).toBeInTheDocument();
    expect(screen.getByText('3:1')).toBeInTheDocument();
  });

  it('dreht Ergebnis und Gegner bei Auswärtsspielen', () => {
    // Die eigene Seite steht im Spieltag selbst; der Prop ist nur der
    // Fallback und greift hier absichtlich nicht.
    render(
      <MatchdayRow
        matchday={makeMatchday({ playerTeamId: '7' })}
        playerTeamId="7"
        teamNames={teamNames}
      />,
    );

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('FC Bayern')).toBeInTheDocument();
    // 1:3 statt 3:1 — die eigene Zahl steht vorn.
    expect(screen.getByText('1:3')).toBeInTheDocument();
  });

  it.each([
    [{ homeGoals: 3, awayGoals: 1 }, 'positive'],
    [{ homeGoals: 1, awayGoals: 1 }, 'muted'],
    [{ homeGoals: 0, awayGoals: 2 }, 'negative'],
  ])('färbt das Ergebnis über data-tone (%o)', (goals, tone) => {
    render(
      <MatchdayRow
        matchday={makeMatchday({ ...goals, playerTeamId: '2' })}
        playerTeamId="2"
        teamNames={teamNames}
      />,
    );
    // Vorher eine Map auf colors.positive/textSecondary/negative im JS.
    const score = screen.getByText(`${goals.homeGoals}:${goals.awayGoals}`);
    expect(score).toHaveAttribute('data-tone', tone);
  });

  it('greift bei leerem playerTeamId auf den Fallback zurück', () => {
    render(
      <MatchdayRow matchday={makeMatchday({ playerTeamId: '' })} playerTeamId="7" teamNames={teamNames} />,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('fällt bei unbekanntem Gegner auf die Team-ID zurück', () => {
    render(<MatchdayRow matchday={makeMatchday()} playerTeamId="2" teamNames={new Map()} />);
    expect(screen.getByText('Team 7')).toBeInTheDocument();
  });
});
