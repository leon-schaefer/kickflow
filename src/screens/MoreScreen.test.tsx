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

/**
 * Die Verzweigung selbst liegt in src/support/shareInvite.ts und ist dort ohne
 * DOM geprüft. Hier geht es nur um das, was der Nutzer davon sieht.
 */
describe('MoreScreen: Liga-Kollegen einladen', () => {
  /*
   * `Partial<Navigator>` ginge nicht: die Zwischenablage müsste dafür ein
   * vollständiges `Clipboard` sein, obwohl `browserShareTarget` nur
   * `writeText` anfasst. Der Stub bildet genau das ab, was gelesen wird.
   */
  function setNavigator(extra: Record<string, unknown>) {
    for (const [key, value] of Object.entries(extra)) {
      Object.defineProperty(window.navigator, key, { value, configurable: true });
    }
  }

  afterEach(() => {
    setNavigator({ share: undefined, clipboard: undefined });
  });

  it('teilt die eigene Adresse über das Teilen-Blatt', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share });
    render(<MoreScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Link teilen' }));

    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0]).toMatchObject({ url: window.location.origin });
    // Geteilt wird die Startseite und nicht die aktuelle Route: der Empfänger
    // hat keine Session und würde von jeder anderen URL weggeleitet.
    expect(share.mock.calls[0][0].url).not.toContain('/more');
  });

  it('sagt es, wenn der Link nur in der Zwischenablage liegt', async () => {
    // Ohne Teilen-Blatt (Desktop-Chrome, Firefox) bleibt die Zwischenablage —
    // dann MUSS die App sagen, dass der Nutzer selbst einfügen muss.
    setNavigator({ clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<MoreScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Link teilen' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Link kopiert');
  });

  it('schweigt, wenn der Nutzer das Teilen-Blatt wegwischt', async () => {
    const abort = new Error('abgebrochen');
    abort.name = 'AbortError';
    setNavigator({ share: vi.fn().mockRejectedValue(abort) });
    render(<MoreScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Link teilen' }));

    // Wegwischen ist eine Antwort und kein Fehler.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('meldet, wenn es gar keinen Weg gibt', async () => {
    render(<MoreScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Link teilen' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Teilen hat nicht funktioniert');
    // Und der Link steht im Klartext daneben: in der installierten PWA gibt es
    // keine Adressleiste, aus der ihn jemand ablesen könnte.
    expect(alert).toHaveTextContent(window.location.origin);
  });
});
