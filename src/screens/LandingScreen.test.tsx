import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LandingScreen } from './LandingScreen';

function setup() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <LandingScreen /> },
      { path: '/login', element: <h1>Anmelden</h1> },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
  return { router };
}

describe('LandingScreen', () => {
  it('führt an beiden Enden der Seite zum Login', () => {
    setup();
    // Oben für den, der überzeugt ist, unten für den, der erst liest. Beide
    // sind echte Links auf eine App-Route — kein Button, der navigiert.
    const toLogin = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/login');
    expect(toLogin).toHaveLength(2);
  });

  it('nennt die Marke als Überschrift der Seite', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'kickflow' })).toBeInTheDocument();
  });

  it('beantwortet die Passwort-Frage, bevor sie gestellt wird', () => {
    setup();
    // Der Grund, warum diese Seite existiert: der Login verlangt ein
    // KICKBASE-Passwort, und wer kickflow zum ersten Mal sieht, kann nicht
    // wissen, wohin es geht. Verschwindet dieser Abschnitt, ist die Seite
    // wieder nur Werbung.
    expect(
      screen.getByRole('heading', { name: 'Was mit deinen Daten passiert' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/verlassen dieses Gerät ausschließlich/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Datenschutzerklärung lesen' })).toBeInTheDocument();
  });

  it('trägt den Hinweis auf die fehlende Verbindung zu Kickbase', () => {
    setup();
    // Steht schon auf dem Login (dort die einzige Stelle vor der Anmeldung) —
    // seit es eine öffentliche Startseite gibt, ist SIE die erste Seite, die
    // ein Fremder sieht.
    expect(screen.getByText(/Nicht mit der Kickbase GmbH verbunden/)).toBeInTheDocument();
  });
});
