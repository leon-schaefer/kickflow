import { beforeEach, describe, expect, it } from 'vitest';
import {
  FREE_ATTEMPTS,
  blockedForSeconds,
  delayAfterFailures,
  recordFailure,
  recordSuccess,
  resetThrottle,
  secondsUntil,
} from './loginThrottle';

beforeEach(() => {
  resetThrottle();
});

describe('delayAfterFailures', () => {
  it('lässt die ersten Versuche frei', () => {
    // Ein Tippfehler im Passwort ist der Normalfall, kein Angriff. Wer beim
    // dritten Mal noch falsch liegt, hat das Passwort nicht — dann kostet
    // Warten nichts.
    expect(delayAfterFailures(0)).toBe(0);
    for (let i = 1; i <= FREE_ATTEMPTS; i += 1) {
      expect(delayAfterFailures(i), `Versuch ${i}`).toBe(0);
    }
    expect(delayAfterFailures(FREE_ATTEMPTS + 1)).toBeGreaterThan(0);
  });

  it('verdoppelt sich je weiterem Fehlversuch', () => {
    expect(delayAfterFailures(3)).toBe(5_000);
    expect(delayAfterFailures(4)).toBe(10_000);
    expect(delayAfterFailures(5)).toBe(20_000);
    expect(delayAfterFailures(6)).toBe(40_000);
  });

  it('läuft in eine Obergrenze und nicht ins Unendliche', () => {
    // Ohne Deckel wären 30 Fehlversuche 5000 * 2^27 ms — also Jahre. Jemand
    // mit vergessenem Passwort soll nicht ausgesperrt bleiben; er kann es bei
    // Kickbase zurücksetzen.
    expect(delayAfterFailures(30)).toBe(300_000);
    expect(delayAfterFailures(1000)).toBe(300_000);
    // Und die Kurve ist monoton — kein Versuch darf die Sperre verkürzen.
    let previous = 0;
    for (let i = 1; i <= 40; i += 1) {
      const current = delayAfterFailures(i);
      expect(current, `Versuch ${i}`).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});

describe('secondsUntil', () => {
  it('rundet auf und wird nie negativ', () => {
    expect(secondsUntil(1_000, 0)).toBe(1);
    // Aufgerundet, damit der Countdown nicht bei 0 stehen bleibt, während die
    // Sperre noch 400 ms läuft.
    expect(secondsUntil(1_400, 0)).toBe(2);
    expect(secondsUntil(0, 5_000)).toBe(0);
    expect(secondsUntil(-1, 0)).toBe(0);
  });
});

describe('Zähler', () => {
  it('sperrt erst nach den freien Versuchen', () => {
    const now = 1_000_000;
    for (let i = 0; i < FREE_ATTEMPTS; i += 1) {
      expect(recordFailure(now), `Versuch ${i + 1}`).toBe(0);
    }
    expect(recordFailure(now)).toBe(5);
  });

  it('verlängert die Sperre mit jedem weiteren Fehlversuch', () => {
    const now = 1_000_000;
    for (let i = 0; i < FREE_ATTEMPTS; i += 1) recordFailure(now);
    expect(recordFailure(now)).toBe(5);
    expect(recordFailure(now)).toBe(10);
    expect(recordFailure(now)).toBe(20);
  });

  it('läuft ab', () => {
    const now = 1_000_000;
    for (let i = 0; i < FREE_ATTEMPTS + 1; i += 1) recordFailure(now);
    expect(blockedForSeconds(now)).toBe(5);
    expect(blockedForSeconds(now + 4_000)).toBe(1);
    expect(blockedForSeconds(now + 5_000)).toBe(0);
    expect(blockedForSeconds(now + 60_000)).toBe(0);
  });

  it('setzt nach einer erfolgreichen Anmeldung ALLES zurück', () => {
    const now = 1_000_000;
    for (let i = 0; i < FREE_ATTEMPTS + 2; i += 1) recordFailure(now);
    expect(blockedForSeconds(now)).toBeGreaterThan(0);

    recordSuccess();
    expect(blockedForSeconds(now)).toBe(0);
    // Nicht nur entsperrt, sondern der ZÄHLER auf null: die Zählung gehört zu
    // „dieser Browser probiert Zugangsdaten durch", und ein Erfolg widerlegt
    // das. Sonst hätte der nächste Fehlversuch nach einem Abmelden sofort
    // wieder eine Sperre.
    expect(recordFailure(now)).toBe(0);
  });

  it('startet ohne Sperre', () => {
    expect(blockedForSeconds()).toBe(0);
  });
});
