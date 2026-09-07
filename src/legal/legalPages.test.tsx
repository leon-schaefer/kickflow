import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { STORAGE_INVENTORY, STORAGE_KEY_PREFIX } from '@/storage/inventory';
import { renderRoute } from '@/test/renderRoute';
import { PRIVACY_PATH, PRIVACY_TITLE, TERMS_PATH, TERMS_TITLE } from './legalRoutes';

/**
 * Die beiden Rechtsseiten, über den echten Route-Baum gemountet.
 *
 * Der wichtigste Test ist der erste, und er prüft eine
 * Erreichbarkeits-Eigenschaft, keine Darstellung: die Seiten müssen OHNE
 * Session laden. Das ist der ganze Grund, warum sie außerhalb von
 * `RequireAuth` hängen (siehe routes.tsx) — die Datenschutzerklärung muss
 * lesbar sein, bevor jemand seine Kickbase-Zugangsdaten eintippt.
 *
 * Diese Eigenschaft bricht lautlos: verschöbe jemand die beiden Routen in den
 * `RequireAuth`-Block, führe der Aufruf still auf den Login um. Für einen
 * angemeldeten Entwickler sähe alles normal aus, und der Link im Login-Fuß —
 * die einzige Stelle, an der die Erklärung vor der Eingabe erreichbar ist —
 * wäre eine Schleife zurück auf den Login.
 */
describe('Rechtsseiten', () => {
  describe.each([
    { path: PRIVACY_PATH, title: PRIVACY_TITLE },
    { path: TERMS_PATH, title: TERMS_TITLE },
  ])('$path', ({ path, title }) => {
    it('lädt OHNE Anmeldung', async () => {
      renderRoute(path, { session: false });
      expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    });

    it('lädt auch angemeldet', async () => {
      renderRoute(path);
      expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    });

    it('nennt den Stand der Fassung', async () => {
      renderRoute(path, { session: false });
      await screen.findByRole('heading', { level: 1, name: title });
      // Eine Rechtsseite ohne Datum lässt nicht erkennen, welche Fassung
      // jemand gelesen hat. `<time>` trägt das maschinenlesbare Datum.
      const time = screen.getByText(/^\d{2}\. \w+ \d{4}$/);
      expect(time.tagName).toBe('TIME');
      expect(time).toHaveAttribute('dateTime', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    });
  });

  describe('Zurück-Weg', () => {
    it('führt ohne Herkunft auf den Login, wenn niemand angemeldet ist', async () => {
      renderRoute(PRIVACY_PATH, { session: false });
      await screen.findByRole('heading', { level: 1, name: PRIVACY_TITLE });
      // Der Normalfall für diese Seiten: Deep Link oder Suchmaschinen-Treffer.
      expect(screen.getByRole('link', { name: /Anmelden/ })).toHaveAttribute('href', '/login');
    });

    it('führt ohne Herkunft in die Ligenliste, wenn jemand angemeldet ist', async () => {
      renderRoute(TERMS_PATH);
      await screen.findByRole('heading', { level: 1, name: TERMS_TITLE });
      expect(screen.getByRole('link', { name: /Meine Ligen/ })).toHaveAttribute(
        'href',
        '/leagues',
      );
    });
  });

  describe('Datenschutzerklärung', () => {
    it('führt JEDEN gespeicherten Eintrag in der Tabelle auf', async () => {
      renderRoute(PRIVACY_PATH, { session: false });
      await screen.findByRole('heading', { level: 1, name: PRIVACY_TITLE });

      // Die Tabelle kommt aus STORAGE_INVENTORY, und inventory.test.ts hält
      // die Liste an keys.ts. Diese beiden Tests zusammen sind die Kopplung,
      // um die es geht: ein neuer localStorage-Schlüssel kann nicht mehr
      // unerwähnt bleiben.
      const table = screen.getByRole('table', { name: /Lokal gespeicherte Einträge/ });
      expect(table).toBeInTheDocument();
      for (const entry of STORAGE_INVENTORY) {
        expect(
          screen.getByText(entry.key),
          `${entry.key} fehlt in der Tabelle`,
        ).toBeInTheDocument();
      }
    });

    it('nennt das Präfix, über das gelöscht wird', async () => {
      renderRoute(PRIVACY_PATH, { session: false });
      await screen.findByRole('heading', { level: 1, name: PRIVACY_TITLE });
      // Der Satz „entfernt alles, was mit … beginnt" muss den echten Wert
      // nennen — sonst beschreibt die Erklärung ein anderes Verhalten als das,
      // was localStore.clearAppData() tut.
      expect(screen.getByText(STORAGE_KEY_PREFIX)).toBeInTheDocument();
    });

    it('sagt ausdrücklich, dass es keine Cookies und kein Tracking gibt', async () => {
      renderRoute(PRIVACY_PATH, { session: false });
      await screen.findByRole('heading', { level: 1, name: PRIVACY_TITLE });
      // Die Aussage trägt die Begründung, warum die App kein Consent-Banner
      // hat. Verschwindet sie, fehlt der Erklärung genau der Teil, den eine
      // Aufsichtsbehörde zuerst sucht.
      expect(
        screen.getByRole('heading', { name: /Keine Cookies, keine Analyse, kein Tracking/ }),
      ).toBeInTheDocument();
      expect(screen.getByText(/setzt keine Cookies/)).toBeInTheDocument();
    });
  });

  describe('Nutzungsbedingungen', () => {
    it('stellt klar, dass keine Verbindung zur Kickbase GmbH besteht', async () => {
      renderRoute(TERMS_PATH, { session: false });
      await screen.findByRole('heading', { level: 1, name: TERMS_TITLE });
      expect(
        screen.getByRole('heading', { name: /Kein Zusammenhang mit der Kickbase GmbH/ }),
      ).toBeInTheDocument();
    });

    it('warnt, dass abgesendete Aktionen echt wirken', async () => {
      renderRoute(TERMS_PATH, { session: false });
      await screen.findByRole('heading', { level: 1, name: TERMS_TITLE });
      // Der Punkt, der diese App von einem Anzeige-Werkzeug unterscheidet: sie
      // gibt echte Gebote im Account des Nutzers ab.
      expect(screen.getByRole('heading', { name: /Aktionen wirken echt/ })).toBeInTheDocument();
    });
  });

  describe('Verweise untereinander', () => {
    it('kommt von der Datenschutzerklärung zu den Bedingungen und zurück', async () => {
      const user = userEvent.setup();
      const { router } = renderRoute(PRIVACY_PATH, { session: false });
      await screen.findByRole('heading', { level: 1, name: PRIVACY_TITLE });

      await user.click(screen.getByRole('link', { name: `${TERMS_TITLE} lesen` }));
      expect(await screen.findByRole('heading', { level: 1, name: TERMS_TITLE })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(TERMS_PATH);

      // Der Zurück-Weg trägt jetzt die Herkunft (withOrigin) und führt damit
      // auf die Datenschutzerklärung, nicht auf den Login-Fallback.
      //
      // Exakter Name und kein RegExp: auf dieser Seite heißt der Zurück-Link
      // „Datenschutz" und der Querverweis am Fuß „Datenschutz lesen" — ein
      // RegExp träfe beide.
      await user.click(screen.getByRole('link', { name: PRIVACY_TITLE }));
      expect(await screen.findByRole('heading', { level: 1, name: PRIVACY_TITLE })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(PRIVACY_PATH);
    });
  });
});
