import { describe, expect, it } from 'vitest';
import { HOMEPAGE_URL, PRIVACY_URL } from './links';
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
});
