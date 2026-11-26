import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { LeagueRanking, LeagueRankingEntry, LineupData, MatchdaySchedule } from '@/api/kickbase';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import { LeagueScreen } from './LeagueScreen';

const auth = vi.hoisted(() => ({ userId: 'me' as string | null }));
const ranking = vi.hoisted(() => ({
  data: undefined as LeagueRanking | undefined,
  error: null as unknown,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const dayRanking = vi.hoisted(() => ({ data: undefined as LeagueRanking | undefined }));
const matchdays = vi.hoisted(() => ({ data: undefined as MatchdaySchedule | undefined }));
const lineup = vi.hoisted(() => ({ data: undefined as LineupData | undefined }));
const rankingCalls = vi.hoisted(() => ({ calls: [] as { day?: number; options: unknown }[] }));
const rules = vi.hoisted(() => ({
  rules: [{ id: 'maxPerTeam', kind: 'maxPerTeam', enabled: true, max: 3 }] as never[],
  updateRule: vi.fn(),
  loaded: true,
  leagueMax: null as number | null,
}));

vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/queries/hooks', () => ({
  useLeagueRanking: (_leagueId: string, day: number | undefined, options: unknown) => {
    rankingCalls.calls.push({ day, options });
    return day === undefined ? ranking : dayRanking;
  },
  useMatchdays: () => matchdays,
  useLineup: () => lineup,
}));
vi.mock('@/lineup/LeagueRulesContext', () => ({ useLeagueRulesContext: () => rules }));
vi.mock('@/leagues/useCompetitionId', () => ({ useCompetitionId: () => '1' }));
vi.mock('@/components/LeagueSwitcher', () => ({ LeagueSwitcher: () => <span>Kickerrunde</span> }));

function entry(overrides: Partial<LeagueRankingEntry>): LeagueRankingEntry {
  return {
    userId: 'x',
    userName: 'Manager',
    userImageUrl: null,
    isAdmin: false,
    hasLineupSet: true,
    seasonPoints: 1000,
    seasonPlace: 1,
    matchdayPoints: 100,
    matchdayPlace: 1,
    teamValue: 60_000_000,
    lineupPlayerIds: [],
    h2hOpponentUserId: null,
    h2hPlace: 0,
    h2hSeasonPoints: 0,
    h2hMatchdayPoints: 0,
    ...overrides,
  };
}

function setup() {
  const router = createMemoryRouter(
    [
      {
        path: '/:leagueId/league',
        element: (
          <LeagueIdProvider id="42">
            <LeagueScreen />
          </LeagueIdProvider>
        ),
      },
      { path: '/:leagueId/manager/:managerId', element: <h1>Manager</h1> },
    ],
    { initialEntries: ['/42/league'] },
  );
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

beforeEach(() => {
  auth.userId = 'me';
  ranking.data = {
    seasonName: '2026/27',
    day: 5,
    entries: [
      entry({ userId: 'rival', userName: 'Rivale', seasonPlace: 2, seasonPoints: 900 }),
      entry({ userId: 'me', userName: 'Ich', seasonPlace: 1, seasonPoints: 1000 }),
    ],
  };
  ranking.error = null;
  dayRanking.data = undefined;
  matchdays.data = undefined;
  lineup.data = undefined;
  rankingCalls.calls = [];
  rules.loaded = true;
  rules.updateRule.mockClear();
});

describe('LeagueScreen', () => {
  it('sortiert nach Saisonplatz, nicht nach Antwortreihenfolge', () => {
    setup();
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]!).getByText('Ich')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Rivale')).toBeInTheDocument();
  });

  it('öffnet die Startelf eines Managers und gibt die Herkunft mit', async () => {
    const { router } = setup();
    await userEvent.click(screen.getByText('Rivale'));

    expect(router.state.location.pathname).toBe('/42/manager/rival');
    expect(router.state.location.state).toEqual({
      fromPath: '/42/league',
      fromTitle: 'Liga',
    });
  });

  it('zeigt Aufstellungsstand und Teamwert je Zeile', () => {
    ranking.data!.entries[0]!.hasLineupSet = false;
    setup();
    expect(screen.getByText(/Aufstellung offen/)).toBeInTheDocument();
    expect(screen.getByText(/Aufstellung steht/)).toBeInTheDocument();
  });

  it('markiert Admins', () => {
    ranking.data!.entries[0]!.isAdmin = true;
    setup();
    expect(screen.getByRole('button', { name: /Rivale/ })).toHaveTextContent('Admin');
  });

  it('lässt die Duell-Karte weg, wenn die Liga keinen Duell-Modus hat', () => {
    setup();
    // `h2hOpponentUserId` fehlt in solchen Ligen komplett — Karte und
    // Zeilen-Hervorhebung entfallen dann lautlos.
    expect(screen.queryByText(/Dein Duell/)).not.toBeInTheDocument();
    expect(screen.queryByText('Duell')).not.toBeInTheDocument();
  });

  it('zeigt Gegner und Punkte des nächsten offenen Spieltags', () => {
    ranking.data!.entries[1]!.h2hOpponentUserId = 'rival';
    const opponent = entry({ userId: 'next', userName: 'Nächster Gegner', seasonPlace: 3 });
    ranking.data!.entries.push(opponent);
    matchdays.data = {
      currentDay: 5,
      matchdays: [
        { day: 5, firstKickoff: '2020-01-01T00:00:00Z', allPlayed: true, fixtures: [] },
        { day: 6, firstKickoff: '2100-01-01T00:00:00Z', allPlayed: false, fixtures: [] },
      ],
    };
    dayRanking.data = {
      ...ranking.data!,
      day: 6,
      entries: [
        entry({ userId: 'me', h2hOpponentUserId: 'next', matchdayPoints: 22, h2hPlace: 3 }),
        { ...opponent, matchdayPoints: 11 },
      ],
    };
    setup();

    expect(rankingCalls.calls).toContainEqual({ day: 6, options: { enabled: true, live: false } });
    expect(screen.getByRole('button', { name: /Dein Duell · Spieltag 6/ })).toHaveTextContent(
      'Du 22 : 11 Nächster Gegner',
    );
    expect(screen.getByText('Duell-Platz 3')).toBeInTheDocument();
    const [, oldRow, newRow] = screen.getAllByRole('listitem');
    expect(oldRow).not.toHaveTextContent('Duell');
    expect(newRow).toHaveTextContent('Duell');
  });

  it('blendet die alte Paarung aus, wenn Kickbase einen anderen Spieltag liefert', () => {
    ranking.data!.entries[1]!.h2hOpponentUserId = 'rival';
    matchdays.data = { currentDay: 6, matchdays: [] };
    dayRanking.data = ranking.data;
    setup();

    expect(screen.queryByText(/Dein Duell/)).not.toBeInTheDocument();
    expect(screen.queryByText('Duell')).not.toBeInTheDocument();
    expect(screen.getByText('Rivale')).toBeInTheDocument();
  });

  it('öffnet über die Duell-Karte direkt den Gegner', async () => {
    ranking.data!.entries[1]!.h2hOpponentUserId = 'rival';
    const { router } = setup();

    await userEvent.click(screen.getByText(/Dein Duell/));
    expect(router.state.location.pathname).toBe('/42/manager/rival');
  });

  it('nennt das Duell ohne Spieltag, wenn keiner bekannt ist', () => {
    ranking.data!.entries[1]!.h2hOpponentUserId = 'rival';
    setup();
    expect(screen.getByText('Dein Duell')).toBeInTheDocument();
  });

  it('verschweigt die Regelkarte, solange der gespeicherte Stand fehlt', () => {
    rules.loaded = false;
    setup();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('schreibt eine Regeländerung von hier aus zurück', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    // Derselbe Context wie im Regel-Screen — der State ist geteilt.
    expect(rules.updateRule).toHaveBeenCalledWith('maxPerTeam', { max: 5 });
  });

  it('sagt es, wenn keine Tabelle da ist', () => {
    ranking.data = { seasonName: null, day: null, entries: [] };
    setup();
    expect(screen.getByText('Keine Liga-Tabelle gefunden.')).toBeInTheDocument();
  });

  it('findet die eigene Zeile und das Duell auch ohne bekannte User-ID', () => {
    // Session von vor der Persistierung der User-ID: dann bleibt der eigene
    // Kader als Erkennungsmerkmal (siehe findOwnRankingEntry).
    auth.userId = null;
    ranking.data!.entries[1]!.h2hOpponentUserId = 'rival';
    ranking.data!.entries[1]!.lineupPlayerIds = ['p1', 'p2'];
    lineup.data = { players: [{ id: 'p1' }, { id: 'p2' }] } as unknown as LineupData;
    setup();

    expect(screen.getByText(/Dein Duell/)).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows[1]!).toHaveTextContent('Duell');
  });

  it('lässt die Duell-Karte weg, wenn die eigene Zeile nicht ableitbar ist', () => {
    auth.userId = null;
    ranking.data!.entries[1]!.h2hOpponentUserId = 'rival';
    setup();

    expect(screen.queryByText(/Dein Duell/)).not.toBeInTheDocument();
  });

  it('fragt während eines laufenden Spieltags dessen Duell live ab', () => {
    matchdays.data = {
      currentDay: 7,
      matchdays: [
        { day: 7, firstKickoff: '2020-01-01T00:00:00Z', allPlayed: false, fixtures: [] },
        { day: 8, firstKickoff: '2100-01-01T00:00:00Z', allPlayed: false, fixtures: [] },
      ],
    };
    setup();

    // Sonst stünde der Duell-Stand bis zum nächsten Pull-to-Refresh still.
    expect(rankingCalls.calls).toContainEqual({ day: 7, options: { enabled: true, live: true } });
  });

  it('fragt das Duell ohne laufenden Spieltag ohne Live-Aktualisierung ab', () => {
    matchdays.data = {
      currentDay: 7,
      matchdays: [{ day: 7, firstKickoff: null, allPlayed: false, fixtures: [] }],
    };
    setup();

    expect(rankingCalls.calls).toContainEqual({ day: 7, options: { enabled: true, live: false } });
  });

  it('zeigt den Fehler mit einem Weg zurück', async () => {
    ranking.data = undefined;
    ranking.error = new Error('Kickbase antwortet nicht');
    setup();

    expect(screen.getByText('Kickbase antwortet nicht')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(ranking.refetch).toHaveBeenCalled();
  });
});
