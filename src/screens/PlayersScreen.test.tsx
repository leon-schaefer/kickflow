import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { CompetitionPlayer, LineupData, MarketData, Team } from '@/api/kickbase';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import { fakeLayout } from '@/test/fakeLayout';
import { squadPlayer } from '@/test/squadPlayer';
import { PlayersScreen } from './PlayersScreen';

const teams = vi.hoisted(() => ({
  data: undefined as Team[] | undefined,
  error: null as unknown,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const players = vi.hoisted(() => ({
  data: undefined as CompetitionPlayer[] | undefined,
  error: null as unknown,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const lineup = vi.hoisted(() => ({
  data: undefined as LineupData | undefined,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const market = vi.hoisted(() => ({
  data: undefined as MarketData | undefined,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const playtimeState = vi.hoisted(() => ({
  playtimes: new Map(),
  pending: 0,
  total: 0,
  refetch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/queries/hooks', () => ({
  useCompetitionTeams: () => teams,
  useCompetitionPlayers: () => players,
  useLineup: () => lineup,
  useMarket: () => market,
  usePlaytimes: () => playtimeState,
}));
vi.mock('@/leagues/useCompetitionId', () => ({ useCompetitionId: () => '1' }));
vi.mock('@/components/LeagueSwitcher', () => ({ LeagueSwitcher: () => <span>Kickerrunde</span> }));

function makePlayer(id: string, name: string, marketValue: number): CompetitionPlayer {
  return {
    id,
    name,
    position: 'MID',
    teamId: '2',
    marketValue,
    marketValueTrend: 'up',
    totalPoints: 400,
    averagePoints: 120,
    valueScoreAvg: 12,
    valueScoreTotal: 40,
    status: 'fit',
    imageUrl: null,
  };
}

function setup() {
  const router = createMemoryRouter(
    [
      {
        path: '/:leagueId/players',
        element: (
          <LeagueIdProvider id="42">
            <PlayersScreen />
          </LeagueIdProvider>
        ),
      },
      { path: '/:leagueId/player/:playerId', element: <h1>Spieler</h1> },
    ],
    { initialEntries: ['/42/players'] },
  );
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

/**
 * Der Virtualizer misst seinen Scroll-Container und rendert nur, was
 * hineinpasst. Ohne gestellte Box wäre das in jsdom nichts — siehe
 * src/test/fakeLayout.ts. Die 8 Zeilen Overscan sorgen dann dafür, dass die
 * drei Testspieler alle im Fenster liegen.
 */
beforeEach(() => {
  fakeLayout();
});

beforeEach(() => {
  teams.data = [
    { id: '2', name: 'FC Bayern', logoUrl: null },
    { id: '7', name: 'Dortmund', logoUrl: null },
  ];
  teams.error = null;
  players.data = [
    makePlayer('1', 'Musiala', 10_000_000),
    makePlayer('2', 'Wirtz', 14_000_000),
    makePlayer('3', 'Kimmich', 8_000_000),
  ];
  players.error = null;
  lineup.data = { players: [squadPlayer({ id: '2', name: 'Wirtz' })] } as LineupData;
  market.data = { players: [], marketValueUpdateAt: null };
  playtimeState.pending = 0;
  playtimeState.total = 0;
});

describe('PlayersScreen', () => {
  it('erklärt eine fehlende Vereinsliste, statt endlos zu drehen', () => {
    // Eine leere Liste (`table` ohne `it`) hält den Spielerquery dauerhaft
    // deaktiviert — QueryState hätte nie einen Fehler zu zeigen.
    teams.data = [];
    setup();
    expect(screen.getByText(/keine Vereine bekannt/)).toBeInTheDocument();
  });

  it('zeigt den Ladezustand der Vereine, nicht den der Spieler', () => {
    teams.data = undefined;
    setup();
    expect(screen.getByRole('status', { name: 'Lädt' })).toBeInTheDocument();
  });

  it('sortiert vorausgewählt nach Marktwert, absteigend', () => {
    setup();
    // Der Virtualizer rendert in jsdom ohne Höhe nur ein Fenster — geprüft
    // wird die Reihenfolge dessen, was er zeigt.
    const rows = screen.getAllByRole('button', { name: /Musiala|Wirtz|Kimmich/ });
    expect(rows[0]).toHaveTextContent('Wirtz');
  });

  it('zählt die Treffer und nennt die Grundmenge, sobald gefiltert wird', async () => {
    setup();
    expect(screen.getByText('3 Spieler')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('searchbox'), 'Musiala');
    expect(screen.getByText('1 von 3 Spielern')).toBeInTheDocument();
  });

  it('grenzt auf den eigenen Kader ein', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Mein Kader' }));

    expect(screen.getByText('1 von 3 Spielern')).toBeInTheDocument();
    expect(screen.queryByText('Musiala')).not.toBeInTheDocument();
  });

  it('bietet Punkte/Min NUR mit Kader-Filter an', async () => {
    setup();
    // Die Kennzahl kostet einen Request pro Spieler — über den ganzen Bestand
    // wären das ~500.
    expect(screen.queryByRole('button', { name: 'Punkte/Min' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mein Kader' }));
    expect(screen.getByRole('button', { name: 'Punkte/Min' })).toBeInTheDocument();
  });

  it('setzt eine Punkte/Min-Sortierung zurück, wenn der Kader-Filter fällt', async () => {
    setup();
    const squadToggle = screen.getByRole('button', { name: 'Mein Kader' });

    await userEvent.click(squadToggle);
    await userEvent.click(screen.getByRole('button', { name: 'Punkte/Min' }));
    expect(screen.getByRole('button', { name: 'Punkte/Min' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(squadToggle);
    // Ohne den Reset liefen die Spielzeit-Requests danach über den GESAMTEN
    // Bestand.
    expect(screen.queryByRole('button', { name: 'Punkte/Min' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marktwert' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('nennt Verein und Herkunft an der Zeile', () => {
    market.data = { players: [{ id: '1' }], marketValueUpdateAt: null } as MarketData;
    setup();

    const musiala = screen.getByRole('button', { name: /Musiala/ });
    expect(within(musiala).getByText('FC Bayern')).toBeInTheDocument();
    expect(within(musiala).getByText('Gelistet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wirtz/ })).toHaveTextContent('Mein Kader');
  });

  it('öffnet das Spielerprofil und gibt die Herkunft mit', async () => {
    const { router } = setup();
    await userEvent.click(screen.getByText('Musiala'));

    expect(router.state.location.pathname).toBe('/42/player/1');
    expect(router.state.location.state).toEqual({
      fromPath: '/42/players',
      fromTitle: 'Spieler',
    });
  });

  it.each([
    [{ squad: false, query: 'gibtesnicht' }, 'Kein Spieler passt zum Filter.'],
    [{ squad: true, query: 'gibtesnicht' }, 'Kein Spieler aus deinem Kader passt zum Filter.'],
  ])('begründet die leere Liste (%o)', async ({ squad, query }, message) => {
    setup();
    if (squad) await userEvent.click(screen.getByRole('button', { name: 'Mein Kader' }));
    await userEvent.type(screen.getByRole('searchbox'), query);
    // „Keine Spieler gefunden" würde bei aktivem Kader-Filter wie ein
    // Ladefehler wirken.
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('sagt „Kader wird geladen", solange der Kader fehlt', async () => {
    lineup.data = undefined;
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Mein Kader' }));
    // Die leere Liste ist dann nur ein Zwischenstand, kein Ergebnis.
    expect(screen.getByText('Kader wird geladen …')).toBeInTheDocument();
  });

  it('meldet nachladende Spielzeiten', () => {
    playtimeState.pending = 2;
    playtimeState.total = 20;
    setup();
    expect(screen.getByText('Spielzeiten … 18/20')).toBeInTheDocument();
  });
});
