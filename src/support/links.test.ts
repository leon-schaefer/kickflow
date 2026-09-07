import { describe, expect, it } from 'vitest';
import { PRIVACY_PATH, TERMS_PATH } from '@/legal/legalRoutes';
import { HOMEPAGE_URL } from './links';
import { resolveSupportUrl } from './supportUrl';

/**
 * Die Konstante geht ungeprüft an `openExternalUrl` — ein Tippfehler (fehlendes
 * Schema, Leerzeichen) fällt sonst erst auf, wenn ein Nutzer draufdrückt. Geprüft
 * wird mit demselben https-Guard, der auch die Spenden-URL absichert.
 */
describe('Projekt-Links', () => {
  it('sind saubere https-URLs', () => {
    expect(resolveSupportUrl(HOMEPAGE_URL)).toBe(HOMEPAGE_URL);
  });

  /**
   * Die Gegenprobe zum Umzug der Datenschutzerklärung in die App: die beiden
   * Rechtsseiten sind APP-PFADE und dürfen nicht als externe URL zurückkehren.
   *
   * Warum das einen Test wert ist: ein `ExternalLink` mit einer
   * codewithleon.dev-Adresse sieht an der Fundstelle völlig normal aus und
   * funktioniert auch — er führt nur an einer zweiten, unabgesicherten
   * Fassung derselben Erklärung vorbei. Genau die Drift soll der Umzug
   * beenden.
   */
  it('führen Datenschutz und Nutzungsbedingungen als interne Pfade', () => {
    for (const path of [PRIVACY_PATH, TERMS_PATH]) {
      expect(path.startsWith('/')).toBe(true);
      // Kein protokollrelativer Pfad: `//host` wäre für den Browser ein
      // Sprung auf einen fremden Host, nicht auf eine App-Route.
      expect(path.startsWith('//')).toBe(false);
      expect(resolveSupportUrl(path), `${path} ist keine externe URL`).toBeNull();
    }
  });
});
