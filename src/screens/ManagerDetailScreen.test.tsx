import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type {
  LeagueRanking,
  LeagueRankingEntry,
  MatchdaySchedule,
  PlayerDetail,
} from '@/api/kickbase';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import { playerDetail } from '@/test/playerDetail';
import { ManagerDetailScreen } from './ManagerDetailScreen';

const seasonRanking = vi.hoisted(() => ({
  data: undefined as LeagueRanking | undefined,
  error: null as unknown,
  isPending: false,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const dayRanking = vi.hoisted(() => ({
  data: undefined as LeagueRanking | undefined,
  error: null as unknown,
  isPending: false,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const matchdays = vi.hoisted(() => ({
  data: undefined as MatchdaySchedule | undefined,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const managerLineup = vi.hoisted(() => ({
  players: new Map<string, PlayerDetail>(),
  pending: 0,
  total: 0,
  refetch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/queries/hooks', () => ({
  // Die Saisonwertung wird OHNE dayNumber abgefragt, die Spieltagswertung mit
  // — genau daran hängt der ganze Screen.
  useLeagueRanking: (_leagueId: string, dayNumber?: number) =>
    dayNumber === undefined ? seasonRanking : dayRanking,
  useMatchdays: () => matchdays,
  usePlayerBasics: () => managerLineup,
  useCompetitionTeams: () => ({ data: [{ id: '2', name: 'FC Bayern', logoUrl: null }] }),
}));
vi.mock('@/leagues/useCompetitionId', () => ({ useCompetitionId: () => '1' }));
vi.mock('@/lineup/LeagueRulesContext', () => ({
  useLeagueRulesContext: () => ({
    rules: [{ id: 'maxPerTeam', kind: 'maxPerTeam', enabled: true, max: 2 }],
  }),
}));

function entry(overrides: Partial<LeagueRankingEntry> = {}): LeagueRankingEntry {
  return {
    userId: 'rival',
    userName: 'Rivale',
    userImageUrl: null,
    isAdmin: false,
    hasLineupSet: true,
    seasonPoints: 900,
    seasonPlace: 2,
    matchdayPoints: 88,
    matchdayPlace: 3,
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
        path: '/:leagueId/manager/:managerId',
        element: (
          <LeagueIdProvider id="42">
            <ManagerDetailScreen />
          </LeagueIdProvider>
        ),
      },
      { path: '/:leagueId/player/:playerId', element: <h1>Spieler</h1> },
    ],
    { initialEntries: ['/42/manager/rival'] },
  );
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

/** Ein Spielplan, dessen Spieltag 7 noch nicht angepfiffen ist (also `open`). */
function openSchedule(): MatchdaySchedule {
  return {
    currentDay: 7,
    matchdays: [{ day: 7, firstKickoff: '2099-05-01T18:30:00Z', allPlayed: false, fixtures: [] }],
  };
}

beforeEach(() => {
  seasonRanking.data = { seasonName: null, day: null, entries: [entry()] };
  seasonRanking.error = null;
  dayRanking.data = undefined;
  dayRanking.isPending = false;
  matchdays.data = undefined;
  managerLineup.players = new Map();
  managerLineup.pending = 0;
  managerLineup.total = 0;
});

describe('ManagerDetailScreen', () => {
  it('nennt den Manager im Kopf und zeigt seine Kennzahlen', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Rivale' })).toBeInTheDocument();
    expect(screen.getByText('Platz')).toBeInTheDocument();
    expect(screen.getByText('Saisonpunkte')).toBeInTheDocument();
  });

  it('sagt es, wenn die Manager-ID unbekannt ist — statt endlos zu laden', () => {
    seasonRanking.data = { seasonName: null, day: null, entries: [] };
    setup();
    expect(screen.getByText('Manager nicht gefunden.')).toBeInTheDocument();
    // Der Zurück-Weg muss auch in diesem Zweig stehen.
    expect(screen.getByRole('link', { name: /Aufstellung/ })).toBeInTheDocument();
  });

  it('weist die Elf als Saisonstand aus, solange kein Spieltag bekannt ist', () => {
    setup();
    expect(screen.getByText(/letzter abgerechneter Spieltag/)).toBeInTheDocument();
    expect(screen.getByText(/Spielplan noch nicht geladen/)).toBeInTheDocument();
  });

  it('sagt, dass Kickbase die Elf für den kommenden Spieltag nicht herausgibt', () => {
    matchdays.data = openSchedule();
    dayRanking.data = { seasonName: null, day: 7, entries: [entry({ lineupPlayerIds: [] })] };
    setup();

    // Fremde Aufstellungen sind vor Anstoß nicht sichtbar — dann bleibt
    // zwangsläufig der letzte abgerechnete Spieltag stehen.
    expect(screen.getByText(/gibt Kickbase noch keine Elf/)).toBeInTheDocument();
  });

  it('meldet, wenn die Antwort einen anderen Spieltag liefert als den angefragten', () => {
    matchdays.data = openSchedule();
    // Kickbase hat `dayNumber` nicht berücksichtigt: Tag 5 statt 7.
    dayRanking.data = { seasonName: null, day: 5, entries: [entry({ lineupPlayerIds: ['1'] })] };
    setup();

    expect(screen.getByText(/letzter abgerechneter Spieltag/)).toBeInTheDocument();
  });

  it('zeigt die Elf des kommenden Spieltags, sobald sie da ist', () => {
    matchdays.data = openSchedule();
    dayRanking.data = { seasonName: null, day: 7, entries: [entry({ lineupPlayerIds: ['1'] })] };
    managerLineup.players = new Map([['1', playerDetail()]]);
    setup();

    expect(screen.getByText('Startelf · Spieltag 7')).toBeInTheDocument();
    expect(screen.getByText('Aufstellung für den kommenden Spieltag.')).toBeInTheDocument();
    expect(screen.getByText('Musiala')).toBeInTheDocument();
  });

  it('markiert einen laufenden Spieltag als Live-Stand', () => {
    matchdays.data = {
      currentDay: 7,
      matchdays: [{ day: 7, firstKickoff: '2020-01-01T18:30:00Z', allPlayed: false, fixtures: [] }],
    };
    dayRanking.data = { seasonName: null, day: 7, entries: [entry({ lineupPlayerIds: ['1'] })] };
    managerLineup.players = new Map([['1', playerDetail()]]);
    setup();

    expect(screen.getByText('Startelf · Spieltag 7 (läuft)')).toBeInTheDocument();
    expect(screen.getByText(/aktualisiert sich jede Minute/)).toBeInTheDocument();
  });

  it('meldet die nachladende Elf mit Fortschritt', () => {
    managerLineup.pending = 4;
    managerLineup.total = 11;
    setup();
    expect(screen.getByText(/Elf wird geladen … 7\/11/)).toBeInTheDocument();
  });

  it('rechnet Kennzahlen und Verteilungen über die Startelf', () => {
    matchdays.data = openSchedule();
    dayRanking.data = {
      seasonName: null,
      day: 7,
      entries: [entry({ lineupPlayerIds: ['1', '2', '3'] })],
    };
    // Drei aus einem Verein bei max. 2 — genau einer zu viel.
    managerLineup.players = new Map([
      ['1', playerDetail({ id: '1', lastName: 'Musiala', marketValue: 10_000_000 })],
      ['2', playerDetail({ id: '2', lastName: 'Kimmich', marketValue: 20_000_000 })],
      ['3', playerDetail({ id: '3', lastName: 'Laimer', marketValue: 6_000_000 })],
    ]);
    setup();

    expect(screen.getByText(/Marktwert der Startelf: /)).toBeInTheDocument();
    expect(screen.getByText('3 · über Grenze')).toBeInTheDocument();
    // Die liga-weite Regel gilt für jeden Manager gleich, nicht nur für den
    // eigenen Kader.
    expect(screen.getByText(/Verletzt: Max. 2 Spieler pro Verein/)).toBeInTheDocument();
  });

  it('öffnet ein Spielerprofil und macht DIESEN Screen zur Herkunft', async () => {
    matchdays.data = openSchedule();
    dayRanking.data = { seasonName: null, day: 7, entries: [entry({ lineupPlayerIds: ['1'] })] };
    managerLineup.players = new Map([['1', playerDetail()]]);
    const { router } = setup();

    await userEvent.click(screen.getByText('Musiala'));

    expect(router.state.location.pathname).toBe('/42/player/1');
    // Zurück soll auf die Rivalen-Elf führen, nicht auf den Liga-Tab.
    expect(router.state.location.state).toEqual({
      fromPath: '/42/manager/rival',
      fromTitle: 'Rivale',
    });
  });

  it('benennt, dass Bankspieler fremder Manager unsichtbar bleiben', () => {
    setup();
    expect(screen.getByText(/keinen Bankspieler/)).toBeInTheDocument();
  });

  it('zeigt den Fehler der Tabelle mit einem Weg zurück', async () => {
    seasonRanking.data = undefined;
    seasonRanking.error = new Error('Kickbase antwortet nicht');
    setup();

    expect(screen.getByText('Kickbase antwortet nicht')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(seasonRanking.refetch).toHaveBeenCalled();
  });
});
