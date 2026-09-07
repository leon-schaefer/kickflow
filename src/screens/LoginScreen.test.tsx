import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { resetThrottle } from '@/auth/loginThrottle';
import { LoginScreen } from './LoginScreen';

const login = vi.hoisted(() => vi.fn());
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ login }) }));

function setup() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginScreen /> },
      { path: '/leagues', element: <h1>Meine Ligen</h1> },
    ],
    { initialEntries: ['/login'] },
  );
  render(<RouterProvider router={router} />);
  return { router };
}

/*
 * Beliebige Formulareingaben, kein Geheimnis: `login` ist gemockt, die Werte
 * verlassen den Test nie. Der Platzhalter-Wert steht hier bewusst so
 * offensichtlich da — ein plausibel aussehendes Passwort hat den
 * Secret-Scanner der CI ausgelöst, und ein unterdrückter Scanner-Treffer ist
 * teurer als ein sprechender Testwert.
 */
const EINGABE = { mail: 'a@b.de', platzhalter: 'PLATZHALTER' };

async function fillIn(mail = EINGABE.mail, eingabe = EINGABE.platzhalter) {
  await userEvent.type(screen.getByRole('textbox', { name: 'E-Mail' }), mail);
  await userEvent.type(screen.getByLabelText('Passwort'), eingabe);
}

beforeEach(() => {
  login.mockReset();
  login.mockResolvedValue(undefined);
  // Der Fehlversuchs-Zähler lebt im Modul und überlebt damit absichtlich
  // einen Screen-Wechsel (siehe src/auth/loginThrottle.ts) — also auch das
  // Unmounten zwischen zwei Tests. Ohne das Zurücksetzen erbt jeder Test die
  // Sperre des vorherigen.
  resetThrottle();
});

describe('LoginScreen', () => {
  /*
   * GEÄNDERTES VERHALTEN: der Absende-Knopf war bei leeren Feldern
   * deaktiviert, jetzt ist er bedienbar und die Prüfung meldet, was fehlt.
   *
   * Das sieht nach einem Rückschritt aus und ist der Grund, warum es hier
   * steht: ein deaktivierter Absende-Knopf sagt nicht, WAS fehlt, ist für
   * Screenreader kommentarlos nicht bedienbar, und er verschluckt genau die
   * Geste, mit der man sich sagen lässt, was noch fehlt. Deaktiviert ist er
   * nur noch, während etwas lädt oder eine Sperre läuft — also dann, wenn
   * Drücken tatsächlich nichts bringen KANN.
   */
  it('lässt sich mit leeren Feldern absenden und sagt dann, was fehlt', async () => {
    setup();
    const submit = screen.getByRole('button', { name: 'Anmelden' });
    expect(submit).toBeEnabled();

    await userEvent.click(submit);
    expect(screen.getByText('Bitte gib deine E-Mail-Adresse ein.')).toBeInTheDocument();
    expect(screen.getByText('Bitte gib dein Passwort ein.')).toBeInTheDocument();
    // Keine Anfrage an Kickbase für etwas, das ohnehin scheitern muss.
    expect(login).not.toHaveBeenCalled();
  });

  it('benennt einen Tippfehler in der Adresse statt sie abzusenden', async () => {
    setup();
    await userEvent.type(screen.getByRole('textbox', { name: 'E-Mail' }), 'a.b.de');
    await userEvent.type(screen.getByLabelText('Passwort'), EINGABE.platzhalter);
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    // „Es fehlt ein @" ist eine Anweisung, „ungültige Adresse" nur ein Urteil.
    expect(screen.getByText('In der E-Mail-Adresse fehlt ein @.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('verbindet die Meldung mit dem Feld, nicht nur mit dem Formular', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    const mail = screen.getByRole('textbox', { name: 'E-Mail' });
    expect(mail).toHaveAttribute('aria-invalid', 'true');
    // aria-describedby muss auf die ID der Meldung zeigen — sonst steht dort
    // roter Text, der sichtbar zuordenbar ist und vorlesbar nicht.
    const describedBy = mail.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      'Bitte gib deine E-Mail-Adresse ein.',
    );
  });

  it('nimmt die Meldung weg, sobald man das Feld anfasst', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(screen.getByText('Bitte gib deine E-Mail-Adresse ein.')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'E-Mail' }), 'a');
    // Nur der Fehler des bearbeiteten Feldes verschwindet — der andere bleibt
    // stehen, weil er noch stimmt.
    expect(screen.queryByText('Bitte gib deine E-Mail-Adresse ein.')).not.toBeInTheDocument();
    expect(screen.getByText('Bitte gib dein Passwort ein.')).toBeInTheDocument();
  });

  it('bremst nach mehreren Fehlversuchen', async () => {
    login.mockRejectedValue(new Error('Anmeldung fehlgeschlagen.'));
    setup();
    await fillIn();

    // Zwei Fehlversuche sind frei — ein Tippfehler ist der Normalfall, kein
    // Angriff (FREE_ATTEMPTS in src/auth/loginThrottle.ts).
    for (let i = 0; i < 2; i += 1) {
      await userEvent.click(screen.getByRole('button', { name: /^Anmelden/ }));
    }
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeEnabled();
    expect(login).toHaveBeenCalledTimes(2);

    // Der dritte kostet.
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Zu viele Fehlversuche/);
    const submit = screen.getByRole('button', { name: /^Anmelden \(\d+ s\)$/ });
    expect(submit).toBeDisabled();

    // Und ein weiterer Klick geht nicht an Kickbase.
    await userEvent.click(submit);
    expect(login).toHaveBeenCalledTimes(3);
  });

  it('meldet an und geht weiter zur Ligenliste', async () => {
    const { router } = setup();
    await fillIn();
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(login).toHaveBeenCalledWith(EINGABE.mail, EINGABE.platzhalter);
    expect(router.state.location.pathname).toBe('/leagues');
  });

  it('ersetzt den Login in der History, statt ihn zu stapeln', async () => {
    const { router } = setup();
    await fillIn();
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    // Sonst führte Zurück aus der Ligenliste in ein Formular, aus dem man
    // schon heraus ist.
    expect(router.state.location.pathname).toBe('/leagues');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('schneidet Leerzeichen aus der E-Mail — Tastaturen hängen gern eins an', async () => {
    setup();
    await fillIn(` ${EINGABE.mail} `);
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(login).toHaveBeenCalledWith(EINGABE.mail, EINGABE.platzhalter);
  });

  it('sendet auch über die Enter-Taste im Feld ab', async () => {
    setup();
    await fillIn();
    // Das war vorher `onSubmitEditing` am Passwortfeld; jetzt macht es das
    // echte <form>.
    await userEvent.keyboard('{Enter}');
    expect(login).toHaveBeenCalledTimes(1);
  });

  it('zeigt den Fehler der Anmeldung und bleibt auf dem Formular', async () => {
    login.mockRejectedValue(new Error('Falsches Passwort'));
    const { router } = setup();
    await fillIn();
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Falsches Passwort');
    expect(router.state.location.pathname).toBe('/login');
  });

  it('kommt aus dem Ladezustand zurück, wenn die Anmeldung scheitert', async () => {
    login.mockRejectedValue(new Error('kaputt'));
    setup();
    await fillIn();
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    // Ohne den finally-Zweig bliebe der Button dauerhaft im Spinner hängen.
    expect(await screen.findByRole('button', { name: 'Anmelden' })).toBeEnabled();
  });

  it('zeigt die Rechtslinks — die einzige Stelle vor dem Login', () => {
    setup();
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Homepage' })).toBeInTheDocument();
  });

  it('nennt den Hinweis, wohin die Zugangsdaten gehen', () => {
    setup();
    expect(screen.getByText(/ausschließlich in Richtung Kickbase/)).toBeInTheDocument();
    expect(screen.getByText(/Inoffizielle App/)).toBeInTheDocument();
  });
});
