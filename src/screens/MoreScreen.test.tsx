import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoreScreen } from './MoreScreen';

const auth = vi.hoisted(() => ({ userName: null as string | null }));
const supportUrl = vi.hoisted(() => ({ SUPPORT_URL: null as string | null }));
const openExternalUrl = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/auth/LogoutButton', () => ({
  LogoutButton: () => <button type="button">Abmelden</button>,
}));
// SUPPORT_URL wird beim Import ausgewertet (import.meta.env, siehe
// src/support/supportUrl.ts) — pro Test setzbar nur über den Mock.
vi.mock('@/support/supportUrl', () => supportUrl);
vi.mock('@/support/openExternalUrl', () => ({ openExternalUrl }));

beforeEach(() => {
  auth.userName = null;
  supportUrl.SUPPORT_URL = 'https://example.test/spenden';
});

afterEach(() => {
  openExternalUrl.mockClear();
  openExternalUrl.mockResolvedValue(undefined);
});

describe('MoreScreen', () => {
  it('trägt den festen Titel statt des Liga-Wechslers', () => {
    render(<MoreScreen />);
    // Der einzige der fünf Tabs, auf dem nichts liga-spezifisch ist.
    expect(screen.getByRole('heading', { level: 1, name: 'Mehr' })).toBeInTheDocument();
  });

  it('zeigt Version und Commit aus dem Build', () => {
    render(<MoreScreen />);
    // Kommt aus `define` in vite.config.ts, vorher aus expo-constants.
    expect(screen.getByText(new RegExp(`Version ${__APP_VERSION__}`))).toBeInTheDocument();
  });

  it('nennt den angemeldeten Namen, wenn er bekannt ist', () => {
    auth.userName = 'Leon';
    render(<MoreScreen />);
    expect(screen.getByText('Angemeldet als Leon.')).toBeInTheDocument();
  });

  it('fällt zurück, wenn der Name nach einem Neustart fehlt', () => {
    // Der AuthProvider stellt aus dem Store nur den Token wieder her.
    render(<MoreScreen />);
    expect(screen.getByText('Mit deinem Kickbase-Konto angemeldet.')).toBeInTheDocument();
  });

  it('öffnet die Unterstützen-Seite extern', async () => {
    render(<MoreScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Unterstützen' }));
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.test/spenden');
  });

  it('meldet ein blockiertes Fenster, statt still zu scheitern', async () => {
    openExternalUrl.mockRejectedValue(new Error('blockiert'));
    render(<MoreScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Unterstützen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Die Seite konnte nicht geöffnet werden.',
    );
  });

  it('lässt die Unterstützen-Karte weg, wenn keine URL konfiguriert ist', () => {
    supportUrl.SUPPORT_URL = null;
    render(<MoreScreen />);
    // Ein Spenden-Button, der ins Leere zeigt, ist schlechter als keiner —
    // und genau so verschwindet die Karte, wenn die Vercel-Env-Var fehlt.
    expect(screen.queryByRole('button', { name: 'Unterstützen' })).not.toBeInTheDocument();
    expect(screen.queryByText(/kickflow unterstützen/)).not.toBeInTheDocument();
  });

  it('hält Homepage und Datenschutz erreichbar', () => {
    render(<MoreScreen />);
    expect(screen.getByRole('link', { name: 'Homepage' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toBeInTheDocument();
  });
});
