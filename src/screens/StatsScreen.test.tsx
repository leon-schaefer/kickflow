import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type {
  LeagueRanking,
  LeagueRankingEntry,
  MatchdaySchedule,
  PlayerTransfer,
} from '@/api/kickbase';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import { lineupData } from '@/test/lineupData';
import { squadPlayer } from '@/test/squadPlayer';
import { StatsScreen } from './StatsScreen';

const auth = vi.hoisted(() => ({ userId: 'me' as string | null }));
const matchdays = vi.hoisted(() => ({
  data: undefined as MatchdaySchedule | undefined,
  error: null as unknown,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const lineup = vi.hoisted(() => ({
  data: undefined as ReturnType<typeof lineupData> | undefined,
  error: null as unknown,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const rankings = vi.hoisted(() => ({
  rankings: new Map<number, LeagueRanking>(),
  pending: 0,
  total: 0,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const points = vi.hoisted(() => ({
  pointsByPlayer: new Map<string, Map<number, number>>(),
  pending: 0,
  total: 0,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const basics = vi.hoisted(() => ({
  players: new Map(),
  pending: 0,
  total: 0,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const transfers = vi.hoisted(() => ({
  transfersByPlayer: new Map<string, PlayerTransfer[]>(),
  pending: 0,
  total: 0,
  refetch: vi.fn().mockResolvedValue(undefined),
  /** Merkt sich, ob der Screen die Historie überhaupt freigeschaltet hat. */
  enabled: false,
}));

vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/leagues/useCompetitionId', () => ({ useCompetitionId: () => '1' }));
vi.mock('@/queries/hooks', () => ({
  useMatchdays: () => matchdays,
  useLineup: () => lineup,
  useCompetitionTeams: () => ({
    data: [
      { id: 'bvb', name: 'Dortmund', logoUrl: null },
      { id: 'fcb', name: 'Bayern', logoUrl: null },
    ],
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
  useMatchdayRankings: () => rankings,
  useMatchdayPoints: () => points,
  usePlayerBasics: () => basics,
  useTransferHistories: (_leagueId: string, _ids: readonly string[], options?: { enabled?: boolean }) => {
    transfers.enabled = options?.enabled ?? true;
    return transfers;
  },
}));

function entry(overrides: Partial<LeagueRankingEntry> = {}): LeagueRankingEntry {
  return {
    userId: 'me',
    userName: 'Ich',
    userImageUrl: null,
    isAdmin: false,
    hasLineupSet: true,
    seasonPoints: 300,
    seasonPlace: 1,
    matchdayPoints: 0,
    matchdayPlace: 0,
    teamValue: 0,
    lineupPlayerIds: [],
    h2hOpponentUserId: null,
    h2hPlace: 0,
    h2hSeasonPoints: 0,
    h2hMatchdayPoints: 0,
    ...overrides,
  };
}

function ranking(day: number, lineupPlayerIds: (string | null)[]): LeagueRanking {
  return {
    seasonName: null,
    day,
    entries: [entry({ lineupPlayerIds }), entry({ userId: 'rival', userName: 'Rivale' })],
  };
}

/**
 * Drei Spieltage sind durch, einer läuft noch — der laufende darf nicht
 * mitzählen (siehe useSeasonPointSources).
 */
function schedule(): MatchdaySchedule {
  return {
    currentDay: 4,
    matchdays: [
      { day: 1, firstKickoff: '2026-08-01T18:30:00Z', allPlayed: true, fixtures: [] },
      { day: 2, firstKickoff: '2026-08-08T18:30:00Z', allPlayed: true, fixtures: [] },
      { day: 3, firstKickoff: '2026-08-15T18:30:00Z', allPlayed: true, fixtures: [] },
      { day: 4, firstKickoff: '2026-08-22T18:30:00Z', allPlayed: false, fixtures: [] },
    ],
  };
}

function setup() {
  const router = createMemoryRouter(
    [
      {
        path: '/:leagueId/stats',
        element: (
          <LeagueIdProvider id="42">
            <StatsScreen />
          </LeagueIdProvider>
        ),
      },
      { path: '/:leagueId/player/:playerId', element: <h1>Spielerprofil</h1> },
    ],
    { initialEntries: ['/42/stats'] },
  );
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

function rowFor(name: string): HTMLElement {
  return screen.getByText(name).closest('li')!;
}

beforeEach(() => {
  auth.userId = 'me';
  matchdays.data = schedule();
  matchdays.error = null;
  lineup.data = lineupData([
    squadPlayer({ id: 'dauerbrenner', name: 'Dauerbrenner', teamId: 'bvb', position: 'FWD' }),
    squadPlayer({ id: 'joker', name: 'Joker', teamId: 'fcb', position: 'MID' }),
  ]);
  lineup.error = null;

  // 'verkauft' stand an Spieltag 1 in der Elf und ist längst weg — er steht
  // deshalb weder im Kader noch in dessen Stammdaten.
  rankings.rankings = new Map([
    [1, ranking(1, ['dauerbrenner', 'verkauft'])],
    [2, ranking(2, ['dauerbrenner', 'joker'])],
    [3, ranking(3, ['dauerbrenner', 'joker'])],
  ]);
  rankings.pending = 0;
  rankings.total = 3;

  points.pointsByPlayer = new Map([
    // Spieltag 4 läuft noch und darf nirgends mitzählen.
    ['dauerbrenner', new Map([[1, 40], [2, 30], [3, 20], [4, 99]])],
    ['joker', new Map([[2, 5], [3, 5]])],
    ['verkauft', new Map([[1, 60], [2, 70], [3, 80]])],
  ]);
  points.pending = 0;
  points.total = 3;

  basics.players = new Map([
    [
      'verkauft',
      { id: 'verkauft', name: 'Verkaufter', teamId: 'bvb', position: 'DEF', imageUrl: null },
    ],
  ]);
  basics.pending = 0;
  basics.total = 1;

  transfers.transfersByPlayer = new Map();
  transfers.pending = 0;
  transfers.enabled = false;
});

describe('StatsScreen — Punktequellen', () => {
  it('zählt je Spieler nur die Spieltage, an denen er in der eigenen Elf stand', () => {
    setup();

    // 40+30+20 = 90, NICHT die 99 vom laufenden Spieltag 4 dazu.
    expect(within(rowFor('Dauerbrenner')).getByText('90')).toBeInTheDocument();
    // Der Verkaufte hat 210 Saisonpunkte, aber nur die 60 aus Spieltag 1
    // gehören mir.
    expect(within(rowFor('Verkaufter')).getByText('60')).toBeInTheDocument();
    expect(within(rowFor('Joker')).getByText('10')).toBeInTheDocument();
  });

  it('führt den besten Punktelieferanten oben', () => {
    setup();
    const names = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(names[0]).toContain('Dauerbrenner');
  });

  it('stellt die Summe der erfassten Punkte den Saisonpunkten gegenüber', () => {
    setup();
    expect(screen.getByText('160')).toBeInTheDocument(); // 90 + 60 + 10
    expect(screen.getByText('300')).toBeInTheDocument(); // seasonPoints aus der Tabelle
  });

  it('nennt auch verkaufte Spieler beim Namen, nicht nur Kaderspieler', () => {
    setup();
    expect(screen.getByText('Verkaufter')).toBeInTheDocument();
  });

  it('summiert auf Wunsch nach Verein statt nach Spieler', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Verein' }));

    // Dortmund = Dauerbrenner (90) + Verkaufter (60).
    expect(within(rowFor('Dortmund')).getByText('150')).toBeInTheDocument();
    expect(within(rowFor('Bayern')).getByText('10')).toBeInTheDocument();
    expect(screen.queryByText('Dauerbrenner')).not.toBeInTheDocument();
  });

  it('summiert auf Wunsch nach Position', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Position' }));

    expect(within(rowFor('ANG')).getByText('90')).toBeInTheDocument();
    expect(within(rowFor('ABW')).getByText('60')).toBeInTheDocument();
  });

  it('lässt in der Ø-Wertung Spieler mit zu wenigen Einsätzen weg', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Ø je Einsatz' }));

    expect(screen.getByText('Dauerbrenner')).toBeInTheDocument();
    // Nur ein Einsatz — ein Schnitt daraus wäre Rauschen.
    expect(screen.queryByText('Verkaufter')).not.toBeInTheDocument();
  });

  it('öffnet das Spielerprofil beim Antippen einer Zeile', async () => {
    const { router } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Dauerbrenner/ }));
    expect(router.state.location.pathname).toBe('/42/player/dauerbrenner');
  });

  it('sagt, wie viele Abfragen noch laufen', () => {
    rankings.pending = 2;
    setup();
    expect(screen.getByRole('status')).toHaveTextContent('noch 2 von 7 Abfragen');
  });

  it('weist Spieltage aus, deren Aufstellung sich nicht zuordnen ließ', () => {
    // Kickbase antwortet für Spieltag 3 mit der Tabelle eines anderen Tages —
    // dann ist die gelieferte Elf nicht die gesuchte.
    rankings.rankings.set(3, ranking(9, ['dauerbrenner', 'joker']));
    setup();

    expect(screen.getByText(/1 Spieltag liegt keine Aufstellung von dir vor/)).toBeInTheDocument();
    // Spieltag 3 fehlt damit auch in den Punkten: 40+30 statt 90.
    expect(within(rowFor('Dauerbrenner')).getByText('70')).toBeInTheDocument();
  });

  it('sagt es, solange kein Spieltag abgerechnet ist', () => {
    matchdays.data = {
      currentDay: 1,
      matchdays: [{ day: 1, firstKickoff: '2026-08-01T18:30:00Z', allPlayed: false, fixtures: [] }],
    };
    rankings.rankings = new Map();
    setup();

    expect(
      screen.getByText('Noch kein Spieltag abgerechnet — die Auswertung beginnt nach dem ersten.'),
    ).toBeInTheDocument();
  });

  it('behält den Zurück-Weg auch im Ladezustand', () => {
    lineup.data = undefined;
    setup();
    expect(screen.getByRole('link', { name: /Aufstellung/ })).toBeInTheDocument();
  });
});

describe('StatsScreen — Transferbilanz', () => {
  const gewinn: PlayerTransfer[] = [
    { date: '2026-08-20T10:00:00Z', buyerId: 'rival', buyerName: 'Rivale', price: 9_000_000 },
    { date: '2026-08-01T10:00:00Z', buyerId: 'me', buyerName: 'Ich', price: 5_000_000 },
  ];

  it('lädt die Historie erst beim Aufklappen', async () => {
    setup();
    expect(transfers.enabled).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /Transferbilanz/ }));
    expect(transfers.enabled).toBe(true);
  });

  it('zeigt Gewinn und Verlust der eigenen Transfers', async () => {
    transfers.transfersByPlayer = new Map([['verkauft', gewinn]]);
    setup();

    await userEvent.click(screen.getByRole('button', { name: /Transferbilanz/ }));

    // Der Name steht auch in der Punkteliste — deshalb in der Sektion suchen.
    const section = screen.getByRole('button', { name: /Transferbilanz/ }).closest('section')!;
    expect(within(section).getByText(/5 Mio € am 01\.08\.2026/)).toBeInTheDocument();
    // Einmal als Gewinn der Zeile, einmal als realisierte Bilanz darüber.
    expect(within(section).getAllByText('+4 Mio €')).toHaveLength(2);
    expect(within(section).getByText('Realisiert')).toBeInTheDocument();
  });

  it('leitet die fehlende eigene User-ID aus dem letzten Spieltag ab', async () => {
    // Ohne User-ID in der Session bleibt der eigene Kader als Merkmal — die
    // Elf des letzten Spieltags überschneidet sich mit ihm, die des Rivalen
    // nicht.
    auth.userId = null;
    transfers.transfersByPlayer = new Map([['verkauft', gewinn]]);
    setup();

    await userEvent.click(screen.getByRole('button', { name: /Transferbilanz/ }));

    const section = screen.getByRole('button', { name: /Transferbilanz/ }).closest('section')!;
    expect(within(section).getAllByText('+4 Mio €')).toHaveLength(2);
  });

  it('erklärt es, wenn sich die eigene User-ID nirgends ableiten lässt', async () => {
    auth.userId = null;
    // Keine Tabelle geladen, also auch kein Kader-Abgleich möglich.
    rankings.rankings = new Map();
    transfers.transfersByPlayer = new Map([['verkauft', gewinn]]);
    setup();

    await userEvent.click(screen.getByRole('button', { name: /Transferbilanz/ }));

    expect(screen.getByText(/Ohne deine Kickbase-Nutzerkennung/)).toBeInTheDocument();
  });
});
