import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { SettingsScreen } from './SettingsScreen';

const logout = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ logout }) }));

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

  it('führt ohne Herkunft zurück in die Aufstellung — der Screen liegt außerhalb einer Liga', () => {
    setup();
    expect(screen.getByRole('link', { name: /Aufstellung/ })).toHaveAttribute('href', '//lineup');
  });

  it('nimmt die mitgegebene Herkunft', () => {
    setup({ fromPath: '/42/more', fromTitle: 'Mehr' });
    expect(screen.getByRole('link', { name: /Mehr/ })).toHaveAttribute('href', '/42/more');
  });
});
