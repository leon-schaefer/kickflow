import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEDBACK_EMAIL } from '@/support/links';
import { FeedbackScreen } from './FeedbackScreen';

/*
 * `openMailto` setzt `window.location.href` — in jsdom eine nicht
 * implementierte Navigation, die die Testausgabe zumüllt. Gemockt wie
 * `openExternalUrl` im Mehr-Tab: geprüft wird, WAS übergeben wird.
 */
const openMailto = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/support/openMailto', () => ({ openMailto }));

const writeText = vi.fn().mockResolvedValue(undefined);

function renderScreen() {
  // Ein Router ist Pflicht: der Zurück-Weg im AppHeader ist ein `<Link>`.
  return render(
    <MemoryRouter initialEntries={['/feedback']}>
      <FeedbackScreen />
    </MemoryRouter>,
  );
}

async function type(text: string) {
  await userEvent.type(screen.getByRole('textbox', { name: 'Dein Feedback' }), text);
}

/** Das dekodierte `body`-Feld der letzten mailto-URL. */
function lastMailBody(): string {
  const url = new URL(openMailto.mock.calls.at(-1)?.[0] as string);
  return new URLSearchParams(url.search).get('body') ?? '';
}

function lastMailSubject(): string {
  const url = new URL(openMailto.mock.calls.at(-1)?.[0] as string);
  return new URLSearchParams(url.search).get('subject') ?? '';
}

beforeEach(() => {
  writeText.mockClear().mockResolvedValue(undefined);
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  openMailto.mockClear();
  openMailto.mockResolvedValue(undefined);
});

describe('FeedbackScreen', () => {
  it('trägt Titel und Zurück-Weg', () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 1, name: 'Feedback' })).toBeInTheDocument();
    // Ohne Herkunft im state führt Zurück in die Ligenliste — der Screen
    // liegt außerhalb von `/:leagueId` und hat keinen Tab als Rückfallebene.
    expect(screen.getByRole('link', { name: /Meine Ligen/ })).toHaveAttribute('href', '/leagues');
  });

  it('hält den Absenden-Knopf zu, solange nichts geschrieben ist', async () => {
    renderScreen();
    const button = screen.getByRole('button', { name: 'Feedback senden' });
    expect(button).toBeDisabled();

    await type('Der Optimizer stellt Verletzte auf.');
    expect(button).toBeEnabled();
  });

  it('lässt Leerzeichen allein nicht als Feedback durch', async () => {
    renderScreen();
    await type('    ');
    expect(screen.getByRole('button', { name: 'Feedback senden' })).toBeDisabled();
  });

  it('übergibt Kategorie und Text als mailto an das Mail-Programm', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Fehler' }));
    await type('Der Optimizer stellt Verletzte auf.');
    await userEvent.click(screen.getByRole('button', { name: 'Feedback senden' }));

    expect(openMailto).toHaveBeenCalledTimes(1);
    expect(openMailto.mock.calls[0][0]).toMatch(
      new RegExp(`^mailto:${FEEDBACK_EMAIL.replace('.', '\\.')}\\?`),
    );
    expect(lastMailSubject()).toBe('[kickflow] Fehler');
    expect(lastMailBody()).toContain('Der Optimizer stellt Verletzte auf.');
  });

  it('startet auf „Funktionswunsch" — das ist der häufigere Fall', async () => {
    renderScreen();
    expect(screen.getByRole('button', { name: 'Funktionswunsch' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await type('Bitte eine Merkliste.');
    await userEvent.click(screen.getByRole('button', { name: 'Feedback senden' }));
    expect(lastMailSubject()).toBe('[kickflow] Funktionswunsch');
  });

  it('hängt die technischen Angaben an und zeigt sie vorher genauso an', async () => {
    renderScreen();
    await type('Kaputt.');
    await userEvent.click(screen.getByRole('button', { name: 'Feedback senden' }));

    const shown = screen.getByText(new RegExp(`Version: ${__APP_VERSION__}`));
    // Was der Screen zeigt, ist wörtlich das, was in der Mail steht — sonst
    // wäre die Anzeige ein Versprechen, das der Text nicht hält.
    expect(lastMailBody()).toContain(shown.textContent ?? '');
  });

  it('liest die Angaben aus der laufenden Umgebung', async () => {
    // Die einzige Stelle, an der `collectFeedbackContext()` geprüft wird:
    // es fasst als einzige Funktion des Moduls das `window` an und gehört
    // deshalb hierher und nicht ins node-Projekt (src/support/feedback.test.ts).
    renderScreen();
    await type('Kaputt.');
    await userEvent.click(screen.getByRole('button', { name: 'Feedback senden' }));

    const body = lastMailBody();
    expect(body).toContain(`Fenster: ${window.innerWidth} × ${window.innerHeight}`);
    expect(body).toContain(`Sprache: ${window.navigator.language}`);
    expect(body).toContain(`Browser: ${window.navigator.userAgent}`);
    // matchMedia ist in src/test/setup.ts gestubbt und meldet immer `false`.
    expect(body).toContain('Anzeige: Browser-Tab');
  });

  it('schickt weder Kontoname noch Liga mit', async () => {
    renderScreen();
    await type('Nur mein Text.');
    await userEvent.click(screen.getByRole('button', { name: 'Feedback senden' }));

    const body = lastMailBody();
    expect(body).not.toMatch(/Liga|Kader|Kickbase-Konto|Token/);
  });

  it('behauptet nichts, was es nicht weiß — der Hinweis nennt das Mail-Programm', async () => {
    renderScreen();
    await type('Kaputt.');
    await userEvent.click(screen.getByRole('button', { name: 'Feedback senden' }));

    // Ob eine Mail wirklich rausgeht, ist von der Seite aus nicht feststellbar
    // (siehe src/support/openMailto.ts) — deshalb „sollte sich geöffnet haben"
    // und kein „gesendet".
    expect(await screen.findByRole('status')).toHaveTextContent(/Mail-Programm sollte sich/);
  });

  it('meldet ein verweigertes Öffnen, statt still zu scheitern', async () => {
    openMailto.mockRejectedValue(new Error('blockiert'));
    renderScreen();
    await type('Kaputt.');
    await userEvent.click(screen.getByRole('button', { name: 'Feedback senden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Mail-Programm ließ sich nicht öffnen/,
    );
    expect(screen.queryByText(/sollte sich jetzt/)).not.toBeInTheDocument();
  });

  it('kopiert Betreff und Text für den Fall ohne Mail-Programm', async () => {
    renderScreen();
    await type('Bitte eine Merkliste.');
    await userEvent.click(screen.getByRole('button', { name: 'Text kopieren' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    // Der Betreff MUSS mit: er trägt die Kategorie, die sonst nirgends im
    // Text steht.
    expect(copied.startsWith('[kickflow] Funktionswunsch')).toBe(true);
    expect(copied).toContain('Bitte eine Merkliste.');
    expect(await screen.findByRole('status')).toHaveTextContent('Kopiert.');
  });

  it('nennt die Adresse, damit sie auch von Hand geht', () => {
    renderScreen();
    expect(screen.getByText(FEEDBACK_EMAIL)).toBeInTheDocument();
  });

  it('gibt zu, wenn die Zwischenablage nicht mitspielt', async () => {
    writeText.mockRejectedValue(new Error('verweigert'));
    renderScreen();
    await type('Bitte eine Merkliste.');
    await userEvent.click(screen.getByRole('button', { name: 'Text kopieren' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Kopieren hat nicht geklappt/);
  });

  it('verspricht kein Kopieren, wo es keine Clipboard-API gibt', async () => {
    // Fehlt real: im unsicheren Kontext und in älteren WebViews. Ein „Kopiert"
    // wäre dort eine Lüge.
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    renderScreen();
    await type('Bitte eine Merkliste.');
    await userEvent.click(screen.getByRole('button', { name: 'Text kopieren' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Kopieren hat nicht geklappt/);
  });

  it('begrenzt den Text auf die Länge, die eine mailto-URL trägt', async () => {
    renderScreen();
    const field = screen.getByRole('textbox', { name: 'Dein Feedback' });
    // Darüber schneiden manche Mail-Programme die URL still ab — und zwar am
    // Ende, wo die technischen Angaben stehen.
    expect(field).toHaveAttribute('maxlength', '2000');
    expect(screen.getByText('0 von 2000 Zeichen')).toBeInTheDocument();

    await type('abc');
    expect(screen.getByText('3 von 2000 Zeichen')).toBeInTheDocument();
  });
});
