import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { LeagueSummary } from '@/api/kickbase';
import { LAST_LEAGUE_KEY } from '@/storage/keys';
import { LeaguesScreen } from './LeaguesScreen';

const query = vi.hoisted(() => ({
  data: undefined as LeagueSummary[] | undefined,
  error: null as unknown,
  refetch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/queries/hooks', () => ({ useLeagues: () => query }));
// Der LogoutButton im rechten Header-Slot hängt sonst am AuthProvider.
vi.mock('@/auth/LogoutButton', () => ({ LogoutButton: () => <button type="button">Abmelden</button> }));

function makeLeague(id: string, name: string, overrides: Partial<LeagueSummary> = {}): LeagueSummary {
  return {
    id,
    name,
    coverImageUrl: null,
    budget: 5_000_000,
    teamValue: 60_000_000,
    memberCount: 12,
    isAdmin: false,
    competitionId: '1',
    ...overrides,
  };
}

function setup() {
  const router = createMemoryRouter(
    [
      { path: '/leagues', element: <LeaguesScreen /> },
      { path: '/:leagueId/lineup', element: <h1>Aufstellung</h1> },
    ],
    { initialEntries: ['/leagues'] },
  );
  render(<RouterProvider router={router} />);
  return { router };
}

beforeEach(() => {
  query.data = [makeLeague('1', 'Kickerrunde'), makeLeague('2', 'Büroliga')];
  query.error = null;
  query.refetch.mockClear();
});

describe('LeaguesScreen', () => {
  it('listet die Ligen mit Teamwert und Managerzahl', () => {
    setup();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Kickerrunde/ })).toHaveTextContent('12 Manager');
    expect(screen.getByRole('button', { name: /Kickerrunde/ })).toHaveTextContent('Teamwert');
  });

  it('lässt die Managerzahl weg, wenn sie nicht ermittelt wurde', () => {
    query.data = [makeLeague('1', 'Kickerrunde', { memberCount: null })];
    setup();
    expect(screen.queryByText(/Manager/)).not.toBeInTheDocument();
  });

  it('öffnet die Aufstellung der gewählten Liga und merkt sie sich', async () => {
    const { router } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Büroliga/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/2/lineup'));
    expect(window.localStorage.getItem(LAST_LEAGUE_KEY)).toBe('2');
  });

  it('markiert die zuletzt genutzte Liga', () => {
    // Synchron aus localStorage im useState-Initializer — vorher brauchte das
    // ein useFocusEffect, weil der Screen unter React Navigation montiert
    // blieb.
    window.localStorage.setItem(LAST_LEAGUE_KEY, '2');
    setup();

    const büro = screen.getByRole('button', { name: /Büroliga/ });
    expect(büro).toHaveTextContent('Zuletzt genutzt');
    expect(screen.getByRole('button', { name: /Kickerrunde/ })).not.toHaveTextContent(
      'Zuletzt genutzt',
    );
  });

  it('sagt es, wenn es keine Ligen gibt', () => {
    query.data = [];
    setup();
    expect(screen.getByText('Keine Ligen gefunden.')).toBeInTheDocument();
  });

  it('zeigt den Ladezustand, solange die Liste fehlt', () => {
    query.data = undefined;
    setup();
    expect(screen.getByRole('status', { name: 'Lädt' })).toBeInTheDocument();
  });

  it('zeigt den Fehler mit einem Weg zurück', async () => {
    query.data = undefined;
    query.error = new Error('Kickbase antwortet nicht');
    setup();

    expect(screen.getByText('Kickbase antwortet nicht')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(query.refetch).toHaveBeenCalled();
  });

  it('trägt den Logout im Kopf — der einzige Weg aus der Session heraus', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Meine Ligen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument();
  });
});
