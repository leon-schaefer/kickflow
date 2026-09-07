import { describe, expect, it } from 'vitest';
import { PRIVACY_PATH, TERMS_PATH } from '@/legal/legalRoutes';
import { resolveFeedbackEmail } from './feedback';
import { FEEDBACK_EMAIL, HOMEPAGE_URL } from './links';
import { resolveSupportUrl } from './supportUrl';

/**
 * Die Konstanten gehen ungeprüft an `openExternalUrl` bzw. `openMailto` — ein
 * Tippfehler (fehlendes Schema, Leerzeichen) fällt sonst erst auf, wenn ein
 * Nutzer draufdrückt. Geprüft wird mit demselben https-Guard, der auch die
 * Spenden-URL absichert.
 */
describe('Projekt-Links', () => {
  it('sind saubere https-URLs', () => {
    expect(resolveSupportUrl(HOMEPAGE_URL)).toBe(HOMEPAGE_URL);
  });

  /*
   * Dieselbe Überlegung für das Feedback-Postfach, nur schärfer: eine
   * kaputte Adresse öffnet ein Mail-Programm, das ins Nichts schreibt — und
   * anders als bei einem toten Link merkt das niemand, weder der Nutzer noch
   * der Empfänger.
   */
  it('ist eine saubere Mail-Adresse ohne angehängte Header', () => {
    expect(resolveFeedbackEmail(FEEDBACK_EMAIL)).toBe(FEEDBACK_EMAIL);
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
