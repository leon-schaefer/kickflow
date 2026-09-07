import { describe, expect, it } from 'vitest';
import { resolveFeedbackEmail } from './feedback';
import { FEEDBACK_EMAIL, HOMEPAGE_URL, PRIVACY_URL } from './links';
import { resolveSupportUrl } from './supportUrl';

/**
 * Die Konstanten gehen ungeprüft an `openExternalUrl` — ein Tippfehler (fehlendes
 * Schema, Leerzeichen) fällt sonst erst auf, wenn ein Nutzer draufdrückt. Geprüft
 * wird mit demselben https-Guard, der auch die Spenden-URL absichert.
 */
describe('Projekt-Links', () => {
  it('sind saubere https-URLs', () => {
    expect(resolveSupportUrl(HOMEPAGE_URL)).toBe(HOMEPAGE_URL);
    expect(resolveSupportUrl(PRIVACY_URL)).toBe(PRIVACY_URL);
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
});
