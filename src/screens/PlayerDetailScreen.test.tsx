import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type {
  LeagueRanking,
  LineupData,
  MarketData,
  MatchdaySchedule,
  PlayerDetail,
  PlayerTransfer,
} from '@/api/kickbase';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import { fakeLayout } from '@/test/fakeLayout';
import { lineupData } from '@/test/lineupData';
import { playerDetail } from '@/test/playerDetail';
import { squadPlayer } from '@/test/squadPlayer';
import { PlayerDetailScreen } from './PlayerDetailScreen';

const auth = vi.hoisted(() => ({ userId: 'me' as string | null }));
const playerQuery = vi.hoisted(() => ({
  data: undefined as PlayerDetail | undefined,
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
const ranking = vi.hoisted(() => ({
  data: undefined as LeagueRanking | undefined,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const matchdays = vi.hoisted(() => ({
  data: undefined as MatchdaySchedule | undefined,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const transfers = vi.hoisted(() => ({
  data: undefined as PlayerTransfer[] | undefined,
  isPending: false,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const excluded = vi.hoisted(() => ({
  isExcluded: vi.fn().mockReturnValue(false),
  toggleExcluded: vi.fn(),
}));

vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/queries/hooks', () => ({
  usePlayer: () => playerQuery,
  useLineup: () => lineup,
  useMarket: () => market,
  useLeagueRanking: () => ranking,
  useMatchdays: () => matchdays,
  usePlayerTransfers: () => transfers,
  useCompetitionTeams: () => ({ data: [{ id: '2', name: 'FC Bayern', logoUrl: null }] }),
}));
vi.mock('@/leagues/useCompetitionId', () => ({ useCompetitionId: () => '1' }));
vi.mock('@/lineup/ExcludedFromSaleContext', () => ({
  useExcludedFromSaleContext: () => excluded,
}));

function setup() {
  const router = createMemoryRouter(
    [
      {
        path: '/:leagueId/player/:playerId',
        element: (
          <LeagueIdProvider id="42">
            <PlayerDetailScreen />
          </LeagueIdProvider>
        ),
      },
      { path: '/:leagueId/manager/:managerId', element: <h1>Manager</h1> },
    ],
    { initialEntries: ['/42/player/1'] },
  );
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

/** Alle drei Besitzer-Quellen geladen — sonst ist „unbekannt" noch keine Antwort. */
function ownerSourcesLoaded() {
  lineup.data = lineupData();
  market.data = { players: [], marketValueUpdateAt: null };
  matchdays.data = undefined;
}

beforeEach(() => {
  fakeLayout();
  auth.userId = 'me';
  playerQuery.data = playerDetail();
  playerQuery.error = null;
  ownerSourcesLoaded();
  ranking.data = undefined;
  transfers.data = undefined;
  transfers.isPending = false;
  excluded.isExcluded.mockReturnValue(false);
  excluded.toggleExcluded.mockClear();
});

describe('PlayerDetailScreen', () => {
  it('nennt den Spieler im Kopf und zeigt Verein und Position', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Jamal Musiala' })).toBeInTheDocument();
    expect(screen.getByText('FC Bayern')).toBeInTheDocument();
    expect(screen.getByText('MF')).toHaveAttribute('data-position', 'MID');
  });

  it('zeigt die Kennzahlen als Paare aus Wert und Bezeichnung', () => {
    setup();
    expect(screen.getByText('Marktwert')).toBeInTheDocument();
    expect(screen.getByText('Tore')).toBeInTheDocument();
    expect(screen.getByText('Assists')).toBeInTheDocument();
  });

  it('zeigt „—" bei Punkte/Min ohne Spielminuten', () => {
    // Kein Fake-„0,00": ohne Spielzeit gibt es kein Verhältnis.
    setup();
    expect(screen.getByText('Punkte/Min')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('hält „Besitzer unbekannt" zurück, solange eine Quelle noch lädt', () => {
    lineup.data = undefined;
    setup();
    // Das wäre eine Aussage über Kickbase, nicht über den Ladezustand.
    expect(screen.getByText('Besitzer …')).toBeInTheDocument();
  });

  it('sagt „Besitzer unbekannt", sobald alle Quellen da sind', () => {
    setup();
    // Ein Bankspieler eines Rivalen ist von einem ungekauften Spieler nicht zu
    // unterscheiden — deshalb steht dort nie „frei".
    expect(screen.getByText('Besitzer unbekannt')).toBeInTheDocument();
  });

  it('erkennt den eigenen Kader', () => {
    lineup.data = lineupData([squadPlayer({ id: '1' })]);
    setup();
    expect(screen.getByText('In deinem Kader')).toBeInTheDocument();
  });

  it('nennt den fremden Manager und springt in seine Ansicht', async () => {
    ranking.data = {
      seasonName: null,
      day: 5,
      entries: [
        {
          userId: 'rival',
          userName: 'Rivale',
          userImageUrl: null,
          isAdmin: false,
          hasLineupSet: true,
          seasonPoints: 0,
          seasonPlace: 1,
          matchdayPoints: 0,
          matchdayPlace: 1,
          teamValue: 0,
          lineupPlayerIds: ['1'],
          h2hOpponentUserId: null,
          h2hPlace: 0,
          h2hSeasonPoints: 0,
          h2hMatchdayPoints: 0,
        },
      ],
    };
    const { router } = setup();

    const link = screen.getByRole('button', { name: /Kader von Rivale/ });
    await userEvent.click(link);

    expect(router.state.location.pathname).toBe('/42/manager/rival');
    // Zurück soll auf dieses Profil führen, nicht auf den Tab davor.
    expect(router.state.location.state).toEqual({
      fromPath: '/42/player/1',
      fromTitle: 'Jamal Musiala',
    });
  });

  it('macht die Besitzerzeile ohne User-ID NICHT antippbar', () => {
    market.data = {
      players: [{ id: '1', sellerName: null, sellerId: null }],
      marketValueUpdateAt: null,
    } as MarketData;
    setup();

    // Ein toter Druckbereich wäre schlechter als reiner Text.
    expect(screen.getByText(/Kein Manager · Kickbase-Angebot/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Kickbase-Angebot/ })).not.toBeInTheDocument();
  });

  it('zeigt das Kaufdatum nur bei eigenen Spielern', () => {
    lineup.data = lineupData([squadPlayer({ id: '1' })]);
    transfers.data = [
      { date: '2026-08-12T10:00:00Z', buyerId: 'me', buyerName: 'Ich', price: 9_000_000 },
    ];
    setup();
    expect(screen.getByText(/Gekauft am 12\.08\.2026/)).toBeInTheDocument();
  });

  it('lässt die Kaufzeile weg, wenn kein Kauf belegbar ist', () => {
    lineup.data = lineupData([squadPlayer({ id: '1' })]);
    transfers.data = [];
    setup();
    // Kickbase führt nicht zu jedem Spieler eine Transferhistorie — ein
    // ausgefallener Zusatzrequest soll keine Fehlermeldung hinterlassen.
    expect(screen.queryByText(/Gekauft/)).not.toBeInTheDocument();
  });

  it('bietet den Verkaufs-Ausschluss nur bei eigenen Spielern an', () => {
    const { unmount } = setup();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    unmount();

    lineup.data = lineupData([squadPlayer({ id: '1' })]);
    setup();
    expect(screen.getByRole('checkbox', { name: /Vom Verkauf ausschließen/ })).toBeInTheDocument();
  });

  it('lässt einen gesetzten Ausschluss auch bei fremden Spielern aufheben', async () => {
    // Sonst ließe er sich nach einem Besitzerwechsel nicht mehr wegnehmen.
    excluded.isExcluded.mockReturnValue(true);
    setup();

    const box = screen.getByRole('checkbox', { name: /Vom Verkauf ausschließen/ });
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(excluded.toggleExcluded).toHaveBeenCalledWith('1');
  });

  it('schaltet den Marktwert-Zeitraum um', async () => {
    playerQuery.data = playerDetail({
      marketValueHistory92: { points: [], lowest: 1_000_000, highest: 2_000_000 },
      marketValueHistory365: { points: [], lowest: 500_000, highest: 3_000_000 },
    });
    setup();

    expect(screen.getByRole('button', { name: '3 Monate' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/Hoch/)).toHaveTextContent('2');

    await userEvent.click(screen.getByRole('button', { name: '1 Jahr' }));
    expect(screen.getByRole('button', { name: '1 Jahr' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Hoch/)).toHaveTextContent('3');
  });

  it('zeigt nur ausgetragene Spieltage, neueste zuerst', () => {
    playerQuery.data = playerDetail({
      performance: [
        {
          title: '2026/27',
          leagueName: 'Bundesliga',
          matchdays: [
            md(1, true),
            md(2, true),
            // Kommende Spieltage würden sonst als Phantom-0:0 dastehen.
            md(3, false),
          ],
        },
      ],
    });
    setup();

    const section = screen.getByRole('heading', { name: /Spieltage 2026\/27/ }).parentElement!
      .parentElement!;
    expect(within(section).getByText('ST 2')).toBeInTheDocument();
    expect(within(section).getByText('ST 1')).toBeInTheDocument();
    expect(within(section).queryByText('ST 3')).not.toBeInTheDocument();
  });

  it('zeigt den Fehler mit einem Weg zurück', async () => {
    playerQuery.data = undefined;
    playerQuery.error = new Error('Kickbase antwortet nicht');
    setup();

    expect(screen.getByText('Kickbase antwortet nicht')).toBeInTheDocument();
    // Der Zurück-Weg steht auch im Fehlerzweig.
    expect(screen.getByRole('link', { name: /Aufstellung/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(playerQuery.refetch).toHaveBeenCalled();
  });
});

function md(day: number, hasResult: boolean) {
  return {
    matchday: day,
    matchDate: `2026-08-0${day}T18:30:00Z`,
    homeTeamId: '2',
    awayTeamId: '7',
    homeGoals: hasResult ? 2 : 0,
    awayGoals: hasResult ? 1 : 0,
    homeLogoUrl: null,
    awayLogoUrl: null,
    playerTeamId: '2',
    hasResult,
    points: 100,
    seasonAveragePoints: 100,
    seasonTotalPoints: 200,
    minutesPlayed: 90,
    isCurrent: false,
  };
}
