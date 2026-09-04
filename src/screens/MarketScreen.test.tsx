import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { MarketData, MarketPlayer, Team } from '@/api/kickbase';
import type { BudgetLimit } from '@/utils/budget';
import { computeBudgetLimit } from '@/utils/budget';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import { MarketScreen } from './MarketScreen';

const market = vi.hoisted(() => ({
  data: undefined as MarketData | undefined,
  error: null as unknown,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const teams = vi.hoisted(() => ({ data: [] as Team[] }));
const leagues = vi.hoisted(() => ({ data: [], refetch: vi.fn().mockResolvedValue(undefined) }));
const playtimeState = vi.hoisted(() => ({
  playtimes: new Map(),
  pending: 0,
  total: 0,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const limit = vi.hoisted(() => ({ current: null as BudgetLimit | null }));

vi.mock('@/queries/hooks', () => ({
  useMarket: () => market,
  useCompetitionTeams: () => teams,
  useLeagues: () => leagues,
  usePlaytimes: () => playtimeState,
  // OfferModal hängt daran, wird hier aber nie geöffnet.
  usePlaceOffer: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveOffer: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/leagues/useBudgetLimit', () => ({ useBudgetLimit: () => limit.current }));
vi.mock('@/leagues/useCompetitionId', () => ({ useCompetitionId: () => '1' }));
vi.mock('@/components/LeagueSwitcher', () => ({ LeagueSwitcher: () => <span>Kickerrunde</span> }));

function makePlayer(overrides: Partial<MarketPlayer> = {}): MarketPlayer {
  return {
    id: '1',
    name: 'Musiala',
    position: 'MID',
    teamId: '2',
    marketValue: 10_000_000,
    marketValueTrend: 'up',
    totalPoints: 400,
    averagePoints: 120,
    valueScoreAvg: 12,
    valueScoreTotal: 40,
    status: 'fit',
    imageUrl: null,
    price: 11_000_000,
    isBotListing: false,
    sellerName: null,
    sellerId: null,
    offerCount: 0,
    listedAt: null,
    expiresInSeconds: null,
    ownOfferPrice: null,
    ownOfferId: null,
    offers: [],
    ...overrides,
  };
}

function setup() {
  const router = createMemoryRouter(
    [
      {
        path: '/:leagueId/market',
        // Wie im echten Baum: LeagueLayout stellt den Context, useLeagueId()
        // gibt dadurch immer einen string statt `string | undefined`.
        element: (
          <LeagueIdProvider id="42">
            <MarketScreen />
          </LeagueIdProvider>
        ),
      },
      { path: '/:leagueId/player/:playerId', element: <h1>Spieler</h1> },
    ],
    { initialEntries: ['/42/market'] },
  );
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

beforeEach(() => {
  market.data = {
    players: [
      makePlayer({ id: '1', name: 'Musiala', valueScoreAvg: 12 }),
      makePlayer({ id: '2', name: 'Wirtz', valueScoreAvg: 20, ownOfferPrice: 9_000_000, ownOfferId: 'o' }),
    ],
    marketValueUpdateAt: null,
  };
  market.error = null;
  teams.data = [];
  playtimeState.pending = 0;
  playtimeState.total = 0;
  limit.current = null;
});

describe('MarketScreen', () => {
  it('sortiert vorausgewählt nach Ø-Punkten pro Million, absteigend', () => {
    setup();
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]!).getByText('Wirtz')).toBeInTheDocument();
  });

  it('filtert auf eigene Gebote und wieder zurück', async () => {
    setup();
    const toggle = screen.getByRole('button', { name: 'Nur meine Gebote' });

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Wirtz')).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('sagt beim leeren Gebotsfilter etwas anderes als beim leeren Markt', async () => {
    market.data = { players: [makePlayer({ ownOfferPrice: null })], marketValueUpdateAt: null };
    setup();

    await userEvent.click(screen.getByRole('button', { name: 'Nur meine Gebote' }));
    // „Keine Spieler gefunden" würde hier wie ein Ladefehler wirken.
    expect(screen.getByText('Du hast auf keinen Spieler geboten.')).toBeInTheDocument();
  });

  it('unterscheidet leeren Filter von leerem Markt', async () => {
    setup();
    await userEvent.type(screen.getByRole('searchbox'), 'gibtesnicht');
    expect(screen.getByText('Kein Spieler passt zum Filter.')).toBeInTheDocument();
  });

  it('sagt es, wenn der Markt leer ist', () => {
    market.data = { players: [], marketValueUpdateAt: null };
    setup();
    expect(screen.getByText('Keine Spieler gefunden.')).toBeInTheDocument();
  });

  it('öffnet das Spielerprofil und gibt die Herkunft mit', async () => {
    const { router } = setup();
    await userEvent.click(screen.getByText('Musiala'));

    expect(router.state.location.pathname).toBe('/42/player/1');
    // Daraus baut der Detail-Screen sein Zurück-Ziel samt Beschriftung.
    expect(router.state.location.state).toEqual({
      fromPath: '/42/market',
      fromTitle: 'Markt',
    });
  });

  it('öffnet den Gebots-Dialog, ohne ins Profil zu wechseln', async () => {
    const { router } = setup();
    await userEvent.click(screen.getAllByRole('button', { name: 'Bieten' })[0]!);

    expect(screen.getByRole('dialog', { name: /Gebot für/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/42/market');
  });

  it('zeigt die Budgetleiste nur mit bekanntem Limit', () => {
    const { unmount } = setup();
    expect(screen.queryByText('Verfügbar')).not.toBeInTheDocument();
    unmount();

    limit.current = computeBudgetLimit({ budget: 5_000_000, teamValue: 30_000_000 });
    setup();
    expect(screen.getByText('Verfügbar')).toBeInTheDocument();
  });

  it('zeigt den Marktwert-Countdown nur, wenn er in der Zukunft liegt', () => {
    market.data = {
      players: [makePlayer()],
      marketValueUpdateAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
    };
    setup();
    expect(screen.getByText(/Nächstes Marktwert-Update in/)).toBeInTheDocument();
  });

  it('meldet nachladende Spielzeiten, statt still umzusortieren', () => {
    playtimeState.pending = 3;
    playtimeState.total = 10;
    setup();
    // Ohne den Hinweis wirkt das Nachsortieren wie ein Fehler.
    expect(screen.getByText('Spielzeiten … 7/10')).toBeInTheDocument();
  });

  it('zeigt Lade- und Fehlerzustand statt einer leeren Liste', async () => {
    market.data = undefined;
    market.error = new Error('Kickbase antwortet nicht');
    setup();

    expect(screen.getByText('Kickbase antwortet nicht')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(market.refetch).toHaveBeenCalled();
  });
});
