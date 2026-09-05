import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogoutButton } from './LogoutButton';

const logout = vi.hoisted(() => vi.fn());
vi.mock('./AuthProvider', () => ({ useAuth: () => ({ logout }) }));

afterEach(() => {
  logout.mockReset();
  vi.useRealTimers();
});

describe('LogoutButton', () => {
  it('meldet beim ersten Klick nicht ab, sondern stellt scharf', async () => {
    render(<LogoutButton />);

    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));

    expect(logout).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Wirklich abmelden?' })).toBeInTheDocument();
  });

  it('meldet beim zweiten Klick ab', async () => {
    logout.mockResolvedValue(undefined);
    render(<LogoutButton />);

    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    await userEvent.click(screen.getByRole('button', { name: 'Wirklich abmelden?' }));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('fällt nach vier Sekunden in den Normalzustand zurück', async () => {
    // Hier bewusst fireEvent statt user-event: user-event wartet intern auf
    // Timer, und mit installierten Fake-Timern bringt die niemand voran — der
    // Test läuft dann in den Timeout, statt die Aussage zu prüfen. Für einen
    // einzelnen Klick ist die echte Event-Sequenz ohnehin nicht der Punkt.
    vi.useFakeTimers();
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    expect(screen.getByRole('button', { name: 'Wirklich abmelden?' })).toBeInTheDocument();

    // Sonst bliebe ein versehentlich angetippter Button beliebig lange scharf.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument();
  });

  it('zeigt den Ladezustand und sperrt den Button während des Abmeldens', async () => {
    let finish: () => void = () => {};
    logout.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    render(<LogoutButton />);

    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    await userEvent.click(screen.getByRole('button', { name: 'Wirklich abmelden?' }));

    expect(screen.getByRole('status', { name: 'Lädt' })).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();

    finish();
  });

  it('kommt aus dem Ladezustand zurück, wenn das Abmelden scheitert', async () => {
    logout.mockRejectedValue(new Error('Speicher gesperrt'));
    render(<LogoutButton />);

    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    await userEvent.click(screen.getByRole('button', { name: 'Wirklich abmelden?' }));

    // Ohne den Reset bliebe der Button dauerhaft im Ladezustand hängen — der
    // Nutzer käme dann nicht mehr aus der Session heraus.
    expect(await screen.findByRole('button', { name: 'Abmelden' })).toBeEnabled();
  });
});
