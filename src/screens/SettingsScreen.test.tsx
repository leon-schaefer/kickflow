import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { openRouterKey } from '@/storage/keys';
import localStore from '@/storage/local';
import { SettingsScreen } from './SettingsScreen';

const logout = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ logout }) }));

vi.mock('@/queries/hooks', () => ({
  useLeagues: () => ({ data: [{ id: '42', name: 'Liga 42' }, { id: '43', name: 'Liga 43' }] }),
}));

function setup(state?: { fromPath: string; fromTitle: string }) {
  const router = createMemoryRouter(
    [
      { path: '/settings', element: <SettingsScreen /> },
      { path: '/login', element: <h1>Anmelden</h1> },
    ],
    { initialEntries: [{ pathname: '/settings', state }] },
  );
  render(<RouterProvider router={router} />);
  return { router };
}

beforeEach(() => {
  logout.mockClear();
  localStore.clearAppData();
});

describe('SettingsScreen', () => {
  it('meldet ab und schickt zum Login', async () => {
    const { router } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));

    expect(logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    // `replace`, damit Zurück nicht in die abgemeldete Einstellungsseite führt.
    expect(router.state.historyAction).toBe('REPLACE');
  });

  // `//lineup` — der Fallback auf den ersten Liga-Tab ohne Liga-Id — ist für
  // den Browser eine protokollrelative URL und landete auf https://lineup/.
  it('führt ohne Herkunft in die Ligenliste — der Screen liegt außerhalb einer Liga', () => {
    setup();
    expect(screen.getByRole('link', { name: /Meine Ligen/ })).toHaveAttribute('href', '/leagues');
  });

  it('nimmt die mitgegebene Herkunft', () => {
    setup({ fromPath: '/42/more', fromTitle: 'Mehr' });
    expect(screen.getByRole('link', { name: /Mehr/ })).toHaveAttribute('href', '/42/more');
  });
  it('verwaltet vorhandene OpenRouter-Schlüssel getrennt nach Liga', async () => {
    const user = userEvent.setup();
    await localStore.setItem(openRouterKey('43'), 'vorhandener-key');
    setup({ fromPath: '/43/market', fromTitle: 'Markt' });
    expect(screen.getByLabelText('Liga')).toHaveValue('43');
    expect(screen.getByLabelText('OpenRouter-API-Schlüssel')).toHaveValue('vorhandener-key');

    await user.selectOptions(screen.getByLabelText('Liga'), '42');
    await user.type(screen.getByLabelText('OpenRouter-API-Schlüssel'), 'neuer-key');
    await user.click(screen.getByRole('button', { name: 'Schlüssel speichern' }));
    expect(await screen.findByText('Schlüssel gespeichert.')).toBeVisible();
    expect(localStore.getItemSync(openRouterKey('42'))).toBe('neuer-key');

    await user.selectOptions(screen.getByLabelText('Liga'), '43');
    await user.clear(screen.getByLabelText('OpenRouter-API-Schlüssel'));
    await user.click(screen.getByRole('button', { name: 'Schlüssel speichern' }));
    expect(await screen.findByText('Schlüssel entfernt.')).toBeVisible();
    expect(localStore.getItemSync(openRouterKey('43'))).toBeNull();
  });

});
