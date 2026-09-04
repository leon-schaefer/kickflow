import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { MatchdaySchedule, ScheduledFixture, Team } from '@/api/kickbase';
import { FixturesScreen } from './FixturesScreen';

const matchdays = vi.hoisted(() => ({
  data: undefined as MatchdaySchedule | undefined,
  error: null as unknown,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const teams = vi.hoisted(() => ({
  data: undefined as Team[] | undefined,
  error: null as unknown,
  refetch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/leagues/useCompetitionId', () => ({ useCompetitionId: () => '1' }));
vi.mock('@/queries/hooks', () => ({
  useMatchdays: () => matchdays,
  useCompetitionTeams: () => teams,
}));

function fixture(home: string, away: string, hg: number | null, ag: number | null): ScheduledFixture {
  return {
    homeTeamId: home,
    awayTeamId: away,
    homeLogoUrl: null,
    awayLogoUrl: null,
    homeGoals: hg,
    awayGoals: ag,
    hasResult: hg !== null,
  };
}

/**
 * Der Spielplan ist so gebaut, dass sich die beiden Blickwinkel wirklich
 * unterscheiden — genau der Fall, den fixtureDifficulty.ts als Begründung
 * für die Trennung nennt: ein torgefährlicher, aber löchriger Gegner ist für
 * Stürmer leicht und für die eigene Abwehr schwer.
 *
 *   'mauer'  schießt wenig, lässt nichts zu  → starke Abwehr, schwacher Angriff
 *   'chaos'  schießt viel, lässt viel zu     → starker Angriff, schwache Abwehr
 *
 * Die beiden gelisteten Mannschaften spielen im Restprogramm nur gegen je
 * einen davon: 'a' immer gegen die Mauer, 'b' immer gegen das Chaos.
 */
function schedule(): MatchdaySchedule {
  // Zwei ausgetragene Spieltage bilden die Torbilanz, aus der die
  // Gegnerstärke normalisiert wird.
  const played = [1, 2].map((day) => ({
    day,
    firstKickoff: `2026-08-0${day}T18:30:00Z`,
    allPlayed: true,
    fixtures: [fixture('mauer', 'füller', 1, 0), fixture('chaos', 'füller2', 4, 4)],
  }));

  // Zwölf offene Spieltage als Restprogramm — genug, damit sich 5 und 10
  // Spiele Vorausschau unterscheiden.
  //
  // Die Anstöße liegen weit in der Zukunft: resolveMatchdayState() sucht den
  // ersten Spieltag, dessen Deadline noch nicht verstrichen ist, und würde
  // sonst mit dem Kalender wandern — der Test wäre je nach Ausführungsdatum
  // ein paar Spiele kürzer.
  const open = Array.from({ length: 12 }, (_, i) => ({
    day: i + 3,
    firstKickoff: `2099-09-${String(i + 1).padStart(2, '0')}T18:30:00Z`,
    allPlayed: false,
    fixtures: [fixture('a', 'mauer', null, null), fixture('b', 'chaos', null, null)],
  }));

  return { currentDay: 3, matchdays: [...played, ...open] };
}

function setup() {
  render(
    <RouterProvider
      router={createMemoryRouter([{ path: '/:leagueId/fixtures', element: <FixturesScreen /> }], {
        initialEntries: ['/42/fixtures'],
      })}
    />,
  );
}

beforeEach(() => {
  matchdays.data = schedule();
  matchdays.error = null;
  teams.data = [
    { id: 'a', name: 'Gegen die Mauer', logoUrl: null },
    { id: 'b', name: 'Gegen das Chaos', logoUrl: null },
  ];
  teams.error = null;
});

describe('FixturesScreen', () => {
  it('zeigt den Ladezustand, bis BEIDE Quellen da sind', () => {
    teams.data = undefined;
    setup();
    // Der Zurück-Weg steht auch im Ladezustand — vorher musste der
    // Stack.Screen.BackButton dafür in jedem Zweig einzeln stehen.
    expect(screen.getByRole('link', { name: /Aufstellung/ })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Lädt' })).toBeInTheDocument();
  });

  it('listet jede Mannschaft mit Streifen und Durchschnitt', () => {
    setup();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Gegen die Mauer')).toBeInTheDocument();
    expect(screen.getByText('Gegen das Chaos')).toBeInTheDocument();
  });

  it('zeigt vorausgewählt fünf Spiele und schaltet auf zehn', async () => {
    setup();
    const row = screen.getAllByRole('listitem')[0]!;
    expect(row.querySelectorAll('[data-difficulty]')).toHaveLength(5);

    await userEvent.click(screen.getByRole('button', { name: '10 Spiele' }));
    expect(screen.getAllByRole('listitem')[0]!.querySelectorAll('[data-difficulty]')).toHaveLength(
      10,
    );
  });

  it('sortiert vom leichtesten Restprogramm nach oben', () => {
    setup();
    // Angriffs-Sicht: gegen die löchrige Abwehr des Chaos ist es leicht zu
    // treffen.
    const [first] = screen.getAllByRole('listitem');
    expect(within(first!).getByText('Gegen das Chaos')).toBeInTheDocument();
  });

  it('dreht die Reihenfolge mit dem Blickwinkel', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Abwehr' }));

    // Abwehr-Sicht: gegen die harmlose Mauer bleibt man leicht sauber — die
    // Reihenfolge dreht sich also.
    const [first] = screen.getAllByRole('listitem');
    expect(within(first!).getByText('Gegen die Mauer')).toBeInTheDocument();
  });

  it('erklärt den gewählten Blickwinkel im Text', async () => {
    setup();
    expect(screen.getByText(/für Stürmer\/Mittelfeld/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Abwehr' }));
    expect(screen.getByText(/ohne Gegentor zu bleiben/)).toBeInTheDocument();
  });

  it('markiert die aktive Auswahl in beiden Gruppen', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Angriff' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '5 Spiele' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('sagt es, wenn kein Restprogramm mehr übrig ist', () => {
    matchdays.data = { currentDay: 34, matchdays: [] };
    setup();
    expect(screen.getByText('Noch kein Restprogramm verfügbar.')).toBeInTheDocument();
  });
});
