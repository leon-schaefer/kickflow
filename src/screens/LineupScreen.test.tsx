import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { LineupData, MarketData, MatchdaySchedule, SquadPlayer } from '@/api/kickbase';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import { LineupDraftProvider } from '@/lineup/LineupDraftContext';
import { mockLineupData } from '@/mock/mockLineup';
import { fakeLayout } from '@/test/fakeLayout';
import pitchStyles from '@/components/Pitch.module.css';
import { LineupScreen } from './LineupScreen';

/**
 * Der größte Screen der App, und der einzige mit einem echten
 * Bearbeitungs-State: Formationswechsel, Tap-Tausch, Optimizer-Übernahme,
 * Speichern-Zustände. Der Optimizer selbst (useLineupOptimizer) läuft hier
 * ECHT mit — nur die Queries sind gestellt. Seine Rechnung ist in
 * src/utils/lineupOptimizer.test.ts abgedeckt; hier geht es um das
 * Zusammenspiel mit dem Entwurf.
 *
 * Datengrundlage ist der 23-Mann-Mock aus src/mock/mockLineup.ts — genau
 * dafür wurde er gebaut: echte Konten haben oft zu wenige Spieler, um
 * überhaupt mehrere Formationen besetzbar zu machen.
 */
const lineup = vi.hoisted(() => ({
  data: undefined as LineupData | undefined,
  error: null as unknown,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const matchdays = vi.hoisted(() => ({
  data: undefined as MatchdaySchedule | undefined,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const market = vi.hoisted(() => ({
  data: { players: [], marketValueUpdateAt: null } as MarketData,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const leagues = vi.hoisted(() => ({ data: [], refetch: vi.fn().mockResolvedValue(undefined) }));
const saveLineup = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
}));
const listPlayer = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
}));

vi.mock('@/queries/hooks', () => ({
  useLineup: () => lineup,
  useMatchdays: () => matchdays,
  useMarket: () => market,
  useLeagues: () => leagues,
  useSaveLineup: () => saveLineup,
  // Kaufpreise der Kaufen/Verkaufen-Liste: hier leer, der Screen zeigt die
  // Zeilen dann wie bisher ohne Kaufpreis (siehe usePurchases).
  usePurchases: () => ({ purchases: new Map(), pending: 0, total: 0 }),
  // Der Screen hält den „Auf den Markt stellen"-Dialog dauerhaft im Baum
  // (er rendert erst bei `open` etwas, siehe MarketListingModal) — sein
  // Mutations-Hook läuft damit in jedem Render mit.
  useListPlayerOnMarket: () => listPlayer,
}));
vi.mock('@/leagues/useCompetitionId', () => ({ useCompetitionId: () => '1' }));
const currentLeague = vi.hoisted(() => ({ id: '42', name: 'Kickerrunde', budget: 5_000_000 }));
vi.mock('@/leagues/useCurrentLeague', () => ({ useCurrentLeague: () => currentLeague }));
vi.mock('@/leagues/useBudgetLimit', () => ({ useBudgetLimit: () => null }));
/*
 * Die beiden Context-Mocks geben BEWUSST stabile Objekte zurück, keine
 * pro Aufruf neu gebauten. Der echte Context tut das auch, und
 * useLineupOptimizer hängt einen Effect an die Identität von `rules` —
 * mit einem frischen Array pro Render wäre daraus eine endlose
 * Render-Schleife geworden.
 */
const rulesValue = vi.hoisted(() => ({
  rules: [{ id: 'maxPerTeam', kind: 'maxPerTeam', enabled: false, max: 3 }] as never[],
}));
const excludedValue = vi.hoisted(() => ({
  excludedIds: new Set<string>(),
  toggleExcluded: vi.fn(),
}));

vi.mock('@/lineup/LeagueRulesContext', () => ({ useLeagueRulesContext: () => rulesValue }));
vi.mock('@/lineup/ExcludedFromSaleContext', () => ({
  useExcludedFromSaleContext: () => excludedValue,
}));
vi.mock('@/components/LeagueSwitcher', () => ({ LeagueSwitcher: () => <span>Kickerrunde</span> }));

/** Ein Spielplan mit offener Deadline — nur dann ist Bearbeiten überhaupt erlaubt. */
function openSchedule(): MatchdaySchedule {
  return {
    currentDay: 3,
    matchdays: [{ day: 3, firstKickoff: '2099-09-05T18:30:00Z', allPlayed: false, fixtures: [] }],
  };
}

/**
 * Die beiden Provider liegen ÜBER dem Router, so wie im echten Baum über dem
 * `<Outlet />` des LeagueLayout. Für den Entwurf ist das keine Kulisse,
 * sondern der Punkt: nur so überlebt er den Weg auf `rules` und zurück.
 */
function setup() {
  const router = createMemoryRouter(
    [
      { path: '/:leagueId/lineup', element: <LineupScreen /> },
      { path: '/:leagueId/player/:playerId', element: <h1>Spieler</h1> },
      { path: '/:leagueId/rules', element: <h1>Regeln</h1> },
      { path: '/:leagueId/fixtures', element: <h1>Restprogramm</h1> },
      { path: '/:leagueId/stats', element: <h1>Statistiken</h1> },
    ],
    { initialEntries: ['/42/lineup'] },
  );
  const view = render(
    <LeagueIdProvider id="42">
      <LineupDraftProvider>
        <RouterProvider router={router} />
      </LineupDraftProvider>
    </LeagueIdProvider>,
  );
  return { router, ...view };
}

/**
 * Die Karten auf dem Feld, in Reihenfolge. Über die Reihen-Klasse des Pitch
 * gesucht und nicht über „alles vor der Bank-Überschrift": darüber liegen auch
 * die Formations-Chips und die Optimizer-Leiste.
 */
function pitchNames(): string[] {
  return [...document.querySelectorAll(`.${pitchStyles.row} button`)].map(
    (b) => b.textContent ?? '',
  );
}

/** Eine Karte auf dem Feld — dort tippt man Spieler heraus. */
function pitchCard(name: string) {
  return [...document.querySelectorAll<HTMLButtonElement>(`.${pitchStyles.row} button`)].find((b) =>
    b.textContent?.includes(name),
  )!;
}

/** Eine Karte auf der Bank — dort tippt man Spieler herein. */
function benchCard(name: string) {
  const bench = screen.getByRole('heading', { name: /^Bank/ });
  return screen
    .getAllByRole('button', { name: new RegExp(name) })
    .find((b) => bench.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)!;
}

async function startEditing() {
  await userEvent.click(screen.getByRole('button', { name: 'Aufstellung bearbeiten' }));
}

beforeEach(() => {
  fakeLayout();
  lineup.data = mockLineupData;
  lineup.error = null;
  matchdays.data = openSchedule();
  saveLineup.isPending = false;
  saveLineup.mutateAsync.mockReset().mockResolvedValue(undefined);
});

describe('LineupScreen', () => {
  it('zeigt Spieltag, Deadline und Teamwert', () => {
    setup();
    expect(screen.getByText('Spieltag 3')).toBeInTheDocument();
    expect(screen.getByText(/Deadline in /)).toBeInTheDocument();
  });

  it('sagt „gesperrt", wenn kein Spieltag mehr offen ist', () => {
    matchdays.data = {
      currentDay: 3,
      matchdays: [{ day: 3, firstKickoff: '2020-01-01T18:30:00Z', allPlayed: false, fixtures: [] }],
    };
    setup();

    expect(screen.getByText('läuft · gesperrt')).toBeInTheDocument();
    // Ohne offenen Spieltag gibt es nichts zu bearbeiten.
    expect(screen.queryByRole('button', { name: 'Aufstellung bearbeiten' })).not.toBeInTheDocument();
  });

  it('öffnet außerhalb des Bearbeitens ein Spielerprofil', async () => {
    const { router } = setup();
    const [first] = pitchNames();
    expect(first).toBeTruthy();

    await userEvent.click(pitchCard('Feldmann'));
    expect(router.state.location.pathname).toMatch(/^\/42\/player\//);
  });

  it('zeigt die Optimizer-Leiste erst im Bearbeitungsmodus', async () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Optimieren' })).not.toBeInTheDocument();

    await startEditing();
    expect(screen.getByRole('button', { name: 'Optimieren' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
  });

  it('behält Bearbeitungsmodus und Entwurf über den Regel-Screen hinweg', async () => {
    const { router } = setup();
    await startEditing();
    // Ein Handgriff, damit sich der Entwurf vom Server-Stand unterscheidet.
    await userEvent.click(pitchCard('Feldmann'));

    // Genau der Weg aus dem Bug: die „Regeln"-Zeile der OptimizerBar hängt
    // den Screen aus, Zurück mountet ihn neu.
    await userEvent.click(screen.getByRole('button', { name: /Regeln|Keine Regeln aktiv/ }));
    expect(router.state.location.pathname).toBe('/42/rules');
    await act(() => router.navigate('/42/lineup'));

    expect(screen.getByRole('button', { name: 'Optimieren' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
    expect(pitchNames().join(' ')).not.toContain('Feldmann');
    expect(screen.getByText(/10 von 11 Positionen besetzt/)).toBeInTheDocument();
  });

  it('entfernt einen Startelf-Spieler auf die Bank', async () => {
    setup();
    await startEditing();
    const before = pitchNames().length;

    await userEvent.click(pitchCard('Feldmann'));

    expect(pitchNames().length).toBe(before - 1);
    expect(screen.getByText(/10 von 11 Positionen besetzt/)).toBeInTheDocument();
  });

  it('sperrt das Speichern, solange die Elf nicht voll ist', async () => {
    setup();
    await startEditing();
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeEnabled();

    await userEvent.click(pitchCard('Feldmann'));
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });

  it('füllt eine freigewordene Position von der Bank', async () => {
    setup();
    await startEditing();

    // Torwart raus, Ersatztorwart rein — dieselbe Position, also kein
    // Formationswechsel nötig.
    await userEvent.click(pitchCard('Feldmann'));
    await userEvent.click(benchCard('Reuter'));

    expect(pitchNames().join(' ')).toContain('Reuter');
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeEnabled();
  });

  it('zieht die Formation mit, wenn ein Bankspieler noch unterkommt', async () => {
    setup();
    await startEditing();

    // Ein Stürmer raus (4-3-2), dann ein fünfter Verteidiger rein: die Elf
    // wäre GK1/DEF5/MID3/FWD2 — das ist 5-3-2. Statt nur einen Tausch
    // anzubieten, zieht die Formation mit.
    await userEvent.click(pitchCard('Wagner'));
    await userEvent.click(benchCard('Kern'));

    expect(screen.getByText('Formation auf 5-3-2 angepasst.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /5-3-2/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeEnabled();
  });

  it('bietet nur einen Tausch an, wenn keine Formation mehr passt', async () => {
    setup();
    await startEditing();

    // 4-3-3 ist voll; ein fünfter Verteidiger käme auf 12 Spieler, und jede
    // Formation summiert auf 11. Dann bleibt der Bankspieler nur vorgemerkt.
    await userEvent.click(benchCard('Kern'));

    expect(screen.queryByText(/Formation auf/)).not.toBeInTheDocument();
    expect(screen.getByText(/um zu tauschen/)).toBeInTheDocument();
    expect(pitchNames()).toHaveLength(11);
  });

  it('beschneidet den Entwurf beim Formationswechsel, ohne ihn aufzufüllen', async () => {
    setup();
    await startEditing();

    // 4-3-3 → 3-4-3: ein Verteidiger weicht, aber die freie
    // Mittelfeld-Position bleibt frei. changeFormation kürzt bewusst nur —
    // wer sie besetzt, entscheidet der Nutzer (oder der Optimizer).
    await userEvent.click(screen.getByRole('button', { name: /3-4-3/ }));

    expect(screen.getByRole('button', { name: /3-4-3/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/10 von 11 Positionen besetzt/)).toBeInTheDocument();
    expect(pitchNames()).toHaveLength(10);
  });

  it('übernimmt die Optimizer-Elf und lässt sie zurücksetzen', async () => {
    setup();
    await startEditing();
    const before = pitchNames().join(' ');

    await userEvent.click(screen.getByRole('button', { name: 'Optimieren' }));
    expect(screen.getByRole('button', { name: 'Zurücksetzen' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    expect(pitchNames().join(' ')).toBe(before);
    // Der Diff-Hinweis verschwindet mit dem Zurücksetzen.
    expect(screen.queryByRole('button', { name: 'Zurücksetzen' })).not.toBeInTheDocument();
  });

  it('verwirft die Optimizer-Marker bei einem manuellen Eingriff', async () => {
    setup();
    await startEditing();
    await userEvent.click(screen.getByRole('button', { name: 'Optimieren' }));
    expect(screen.getByRole('button', { name: 'Zurücksetzen' })).toBeInTheDocument();

    // Ein Handgriff macht den eingefrorenen Diff ungültig.
    await userEvent.click(pitchCard('Brandt'));
    expect(screen.queryByRole('button', { name: 'Zurücksetzen' })).not.toBeInTheDocument();
  });

  it('speichert die Elf positionssortiert', async () => {
    setup();
    await startEditing();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(saveLineup.mutateAsync).toHaveBeenCalledTimes(1);
    const { formation, playerIds } = saveLineup.mutateAsync.mock.calls[0]![0];
    expect(formation).toBe(mockLineupData.formation);
    // Kickbase erwartet die IDs nach Position geordnet (siehe
    // orderIdsByPosition) — nicht in Tap-Reihenfolge.
    const positions = playerIds.map(
      (id: string) => mockLineupData.players.find((p: SquadPlayer) => p.id === id)!.position,
    );
    expect(positions).toEqual([...positions].sort(byPositionOrder));
  });

  it('verlässt den Bearbeitungsmodus nach dem Speichern', async () => {
    setup();
    await startEditing();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Aufstellung bearbeiten' })).toBeInTheDocument(),
    );
  });

  it('zeigt einen Speicherfehler und bleibt im Bearbeitungsmodus', async () => {
    saveLineup.mutateAsync.mockRejectedValue(new Error('Kickbase lehnt ab'));
    setup();
    await startEditing();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Kickbase lehnt ab');
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
  });

  it('wirft den Entwurf beim Abbrechen weg', async () => {
    setup();
    await startEditing();
    const original = pitchNames().join(' ');

    await userEvent.click(pitchCard('Feldmann'));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(pitchNames().join(' ')).toBe(original);
  });

  it('führt zur Statistik und gibt die Herkunft mit', async () => {
    const { router } = setup();
    const link = screen.getByRole('link', { name: 'Statistiken' });
    expect(link).toHaveAttribute('href', '/42/stats');

    await userEvent.click(link);
    expect(router.state.location.pathname).toBe('/42/stats');
    expect(router.state.location.state).toEqual({
      fromPath: '/42/lineup',
      fromTitle: 'Aufstellung',
    });
  });

  it('führt zum Restprogramm und gibt die Herkunft mit', async () => {
    const { router } = setup();
    const link = screen.getByRole('link', { name: 'Restprogramm' });
    // Ein echtes <a href>: „in neuem Tab öffnen" bleibt möglich.
    expect(link).toHaveAttribute('href', '/42/fixtures');

    await userEvent.click(link);
    expect(router.state.location.pathname).toBe('/42/fixtures');
    expect(router.state.location.state).toEqual({
      fromPath: '/42/lineup',
      fromTitle: 'Aufstellung',
    });
  });

  it('führt aus der Optimizer-Leiste zu den Regeln', async () => {
    const { router } = setup();
    await startEditing();

    await userEvent.click(screen.getByRole('button', { name: /Regeln|Keine Regeln aktiv/ }));
    expect(router.state.location.pathname).toBe('/42/rules');
  });

  it('zeigt den Fehler der Aufstellung mit einem Weg zurück', async () => {
    lineup.data = undefined;
    lineup.error = new Error('Kickbase antwortet nicht');
    setup();

    expect(screen.getByText('Kickbase antwortet nicht')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(lineup.refetch).toHaveBeenCalled();
  });
});

const POSITION_ORDER = ['GK', 'DEF', 'MID', 'FWD'];
function byPositionOrder(a: string, b: string) {
  return POSITION_ORDER.indexOf(a) - POSITION_ORDER.indexOf(b);
}
