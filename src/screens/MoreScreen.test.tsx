import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRIVACY_PATH, TERMS_PATH } from '@/legal/legalRoutes';
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

/**
 * Seit Datenschutz und Nutzungsbedingungen APP-Routen sind (statt externer
 * Links), braucht der Screen einen Router: `<Link>` und `useLocation` gibt es
 * nicht ohne. Ein MemoryRouter statt `renderRoute` — der Screen selbst wird
 * hier isoliert geprüft, der echte Route-Baum in routes.test.tsx.
 *
 * Der Pfad ist ein echter Tab-Pfad, weil der Screen ihn als Herkunft für den
 * Zurück-Weg der Rechtsseiten mitgibt.
 */
function renderMore(path = '/42/more') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MoreScreen />
    </MemoryRouter>,
  );
}

describe('MoreScreen', () => {
  it('trägt den festen Titel statt des Liga-Wechslers', () => {
    renderMore();
    // Der einzige der fünf Tabs, auf dem nichts liga-spezifisch ist.
    expect(screen.getByRole('heading', { level: 1, name: 'Mehr' })).toBeInTheDocument();
  });

  it('zeigt Version und Commit aus dem Build', () => {
    renderMore();
    // Kommt aus `define` in vite.config.ts, vorher aus expo-constants.
    expect(screen.getByText(new RegExp(`Version ${__APP_VERSION__}`))).toBeInTheDocument();
  });

  it('nennt den angemeldeten Namen, wenn er bekannt ist', () => {
    auth.userName = 'Leon';
    renderMore();
    expect(screen.getByText('Angemeldet als Leon.')).toBeInTheDocument();
  });

  it('fällt zurück, wenn der Name nach einem Neustart fehlt', () => {
    // Der AuthProvider stellt aus dem Store nur den Token wieder her.
    renderMore();
    expect(screen.getByText('Mit deinem Kickbase-Konto angemeldet.')).toBeInTheDocument();
  });

  it('öffnet die Unterstützen-Seite extern', async () => {
    renderMore();
    await userEvent.click(screen.getByRole('button', { name: 'Unterstützen' }));
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.test/spenden');
  });

  it('meldet ein blockiertes Fenster, statt still zu scheitern', async () => {
    openExternalUrl.mockRejectedValue(new Error('blockiert'));
    renderMore();

    await userEvent.click(screen.getByRole('button', { name: 'Unterstützen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Die Seite konnte nicht geöffnet werden.',
    );
  });

  it('lässt die Unterstützen-Karte weg, wenn keine URL konfiguriert ist', () => {
    supportUrl.SUPPORT_URL = null;
    renderMore();
    // Ein Spenden-Button, der ins Leere zeigt, ist schlechter als keiner —
    // und genau so verschwindet die Karte, wenn die Vercel-Env-Var fehlt.
    expect(screen.queryByRole('button', { name: 'Unterstützen' })).not.toBeInTheDocument();
    expect(screen.queryByText(/kickflow unterstützen/)).not.toBeInTheDocument();
  });

  it('hält Homepage, Datenschutz und Nutzungsbedingungen erreichbar', () => {
    renderMore();
    // Die Homepage bleibt ein externer Link (ExternalLink rendert einen
    // <button role="link">), die beiden Rechtsseiten sind App-Routen.
    expect(screen.getByRole('link', { name: 'Homepage' })).toBeInTheDocument();
    // Auf den href geprüft und nicht nur auf die Existenz: das ist der
    // Unterschied, den der Umzug macht — vorher führten beide nach außen.
    // Zeigte der Link wieder auf codewithleon.dev, blieb ein Test auf den
    // reinen Linktext grün.
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute(
      'href',
      PRIVACY_PATH,
    );
    expect(screen.getByRole('link', { name: 'Nutzungsbedingungen' })).toHaveAttribute(
      'href',
      TERMS_PATH,
    );
  });
});
