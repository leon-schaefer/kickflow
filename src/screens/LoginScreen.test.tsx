import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
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
});

describe('LoginScreen', () => {
  it('sperrt das Absenden, solange ein Feld leer ist', async () => {
    setup();
    const submit = screen.getByRole('button', { name: 'Anmelden' });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox', { name: 'E-Mail' }), 'a@b.de');
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Passwort'), 'x');
    expect(submit).toBeEnabled();
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
