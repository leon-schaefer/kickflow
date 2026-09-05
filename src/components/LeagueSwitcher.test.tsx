import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { LeagueSummary } from '@/api/kickbase';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import { LeagueSwitcher } from './LeagueSwitcher';

const leagues = vi.hoisted(() => ({ data: undefined as LeagueSummary[] | undefined }));
const setLastLeagueId = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

// Statt QueryClient + AuthProvider aufzubauen: der Switcher braucht von den
// Queries nur die Liste, und die Herkunft ist hier nicht das Thema.
vi.mock('@/queries/hooks', () => ({ useLeagues: () => leagues }));
vi.mock('@/leagues/lastLeague', () => ({ setLastLeagueId }));

const LEAGUES: LeagueSummary[] = [
  { id: '1', name: 'Kickerrunde' },
  { id: '2', name: 'Büroliga' },
] as LeagueSummary[];

/** `loading: true` = die Liste ist noch nicht da (`useLeagues().data === undefined`). */
function setup({ loading = false, at = '/1/lineup' }: { loading?: boolean; at?: string } = {}) {
  leagues.data = loading ? undefined : LEAGUES;
  const router = createMemoryRouter(
    [
      {
        path: '/:leagueId/*',
        element: (
          <LeagueIdProvider id="1">
            <LeagueSwitcher />
          </LeagueIdProvider>
        ),
      },
      { path: '*', element: <span>anderswo</span> },
    ],
    { initialEntries: [at] },
  );
  render(<RouterProvider router={router} />);
  return { router };
}

beforeEach(() => {
  leagues.data = LEAGUES;
});

afterEach(() => {
  setLastLeagueId.mockClear();
});

describe('LeagueSwitcher', () => {
  it('zeigt den Namen der aktuellen Liga', () => {
    setup();
    expect(screen.getByRole('button', { name: /Kickerrunde/ })).toBeInTheDocument();
  });

  it('fällt auf „Liga" zurück, solange die Liste fehlt', () => {
    setup({ loading: true });
    expect(screen.getByRole('button', { name: 'Liga' })).toBeInTheDocument();
  });

  it('öffnet den Dialog erst auf Tap', async () => {
    setup();
    const trigger = screen.getByRole('button', { name: 'Kickerrunde' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Liga wechseln' })).toBeInTheDocument();
  });

  it('zeigt einen Spinner, solange die Liste lädt', async () => {
    setup({ loading: true });
    await userEvent.click(screen.getByRole('button', { name: 'Liga' }));
    expect(screen.getByRole('status', { name: 'Lädt' })).toBeInTheDocument();
  });

  it('markiert die aktuelle Liga in der Liste', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Kickerrunde' }));

    // Im Dialog suchen, nicht global: der Auslöser trägt denselben Namen.
    // Vorher war der Haken die einzige Auszeichnung — rein visuell.
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('button', { name: 'Kickerrunde' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(dialog.getByRole('button', { name: 'Büroliga' })).not.toHaveAttribute('aria-current');
  });

  it('wechselt die Liga und merkt sie sich', async () => {
    const { router } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Kickerrunde' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Büroliga' }),
    );

    expect(setLastLeagueId).toHaveBeenCalledWith('2');
    expect(router.state.location.pathname).toBe('/2/lineup');
  });

  it('schließt nur, wenn man die aktuelle Liga wählt', async () => {
    const { router } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Kickerrunde' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Kickerrunde' }),
    );

    // Kein zweiter Eintrag in der History und kein Schreiben — der Wechsel
    // auf die eigene Liga ist keiner.
    expect(setLastLeagueId).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/1/lineup');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([
    ['Meine Ligen', '/leagues'],
    ['Einstellungen', '/settings'],
  ])('führt über den Fuß nach %s', async (label, path) => {
    const { router } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Kickerrunde' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: label }),
    );

    expect(router.state.location.pathname).toBe(path);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Ohne die Herkunft zeigte der Zurück-Pfeil der Einstellungen immer auf
  // „Aufstellung", egal aus welchem Tab der Dialog geöffnet wurde.
  it.each([
    ['/1/market', 'Markt'],
    ['/1/league', 'Liga'],
  ])('gibt den verlassenen Tab (%s) als Herkunft mit', async (from, title) => {
    const { router } = setup({ at: from });
    await userEvent.click(screen.getByRole('button', { name: 'Kickerrunde' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Einstellungen' }),
    );

    expect(router.state.location.state).toEqual({ fromPath: from, fromTitle: title });
  });
});
