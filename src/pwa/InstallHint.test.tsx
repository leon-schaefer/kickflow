import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/auth/AuthProvider';
import { INSTALL_HINT_KEY, SESSION_KEY } from '@/storage/keys';
import { InstallHint } from './InstallHint';
import { clearInstallPrompt } from './installPromptStore';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

/** jsdom hat keinen echten UA-Wechsel — hier wird er gesetzt. */
function setPlatform(userAgent: string, maxTouchPoints = 5) {
  for (const [key, value] of [
    ['userAgent', userAgent],
    ['maxTouchPoints', maxTouchPoints],
  ] as const) {
    Object.defineProperty(window.navigator, key, { value, configurable: true });
  }
}

function setStandalone(standalone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: standalone && query.includes('display-mode: standalone'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function login() {
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ token: 'test-token', refreshToken: null }),
  );
}

function setup() {
  return render(
    <AuthProvider>
      <InstallHint />
    </AuthProvider>,
  );
}

/** Das abgefangene Event lebt im Modul-Store und überdauert sonst den Test. */
afterEach(() => {
  clearInstallPrompt();
  // Zurück auf „kein Standalone" statt `unstubAllGlobals()`: matchMedia gibt
  // es in jsdom gar nicht, es stammt selbst aus einem Stub in
  // src/test/setup.ts — ein vollständiges Aufräumen nähme es dem nächsten Test.
  setStandalone(false);
});

describe('InstallHint', () => {
  it('erscheint nach dem Login mit der Anleitung der Plattform', async () => {
    setPlatform(IPHONE);
    login();
    setup();

    // Der Token kommt asynchron aus dem Speicher — vorher weiß niemand, ob
    // überhaupt jemand angemeldet ist.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Zum Home-Bildschirm/)).toBeInTheDocument();
  });

  it('bleibt ohne Login weg', async () => {
    setPlatform(IPHONE);
    setup();

    // Vor dem Login ist der Vorschlag eine Frage an jemanden, der die App
    // noch nicht gesehen hat.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('bleibt in der installierten PWA weg', async () => {
    setPlatform(IPHONE);
    setStandalone(true);
    login();
    setup();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('kommt nach dem Wegtippen nicht wieder', async () => {
    setPlatform(IPHONE);
    login();
    const first = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Verstanden' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(INSTALL_HINT_KEY)).not.toBeNull();

    // Neu gemountet, wie beim nächsten Start: der Merker liegt im Speicher.
    first.unmount();
    setup();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('schaltet auf den Browser-Dialog um, sobald das Event eintrifft', async () => {
    setPlatform(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    );
    login();
    setup();

    // Bis Chromium sich meldet, bleibt nur die Anleitung übers Menü.
    expect(await screen.findByText(/Browser-Menü/)).toBeInTheDocument();

    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt'), { prompt });
    window.dispatchEvent(event);

    const button = await screen.findByRole('button', { name: 'Installieren' });
    await userEvent.click(button);

    expect(prompt).toHaveBeenCalledTimes(1);
    // Auch der Weg über den Browser-Dialog ist ein Weg: der Hinweis hat seine
    // Aufgabe erfüllt und kommt nicht wieder.
    expect(window.localStorage.getItem(INSTALL_HINT_KEY)).not.toBeNull();
  });
});
