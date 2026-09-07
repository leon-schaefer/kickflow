import { describe, expect, it } from 'vitest';
import { hasErrors, validateCredentials } from './loginValidation';

const OK_PASSWORD = 'PLATZHALTER';

/*
 * Testwerte sind absichtlich offensichtlich Platzhalter: ein plausibel
 * aussehendes Passwort hat den Secret-Scanner der CI schon einmal ausgelöst,
 * und ein unterdrückter Scanner-Treffer ist teurer als ein sprechender
 * Testwert (dieselbe Begründung wie in LoginScreen.test.tsx).
 */
describe('validateCredentials', () => {
  it('lässt eine gewöhnliche Adresse durch', () => {
    expect(validateCredentials('leon@example.de', OK_PASSWORD)).toEqual({});
  });

  it('trimmt, weil das Absenden auch trimmt', () => {
    // Sonst meldet die Prüfung einen Fehler, den das Absenden nicht hätte —
    // LoginScreen sendet `email.trim()`.
    expect(validateCredentials('  leon@example.de  ', OK_PASSWORD)).toEqual({});
  });

  it('benennt fehlende Eingaben einzeln', () => {
    expect(validateCredentials('', '')).toEqual({
      email: 'Bitte gib deine E-Mail-Adresse ein.',
      password: 'Bitte gib dein Passwort ein.',
    });
    // Nur Whitespace ist keine Eingabe.
    expect(validateCredentials('   ', OK_PASSWORD).email).toBe(
      'Bitte gib deine E-Mail-Adresse ein.',
    );
  });

  it('nennt das fehlende @ als eigenen Fall', () => {
    // Der häufigste Tippfehler, und „es fehlt ein @" ist eine Anweisung,
    // während „ungültige Adresse" nur ein Urteil ist.
    expect(validateCredentials('leon.example.de', OK_PASSWORD).email).toBe(
      'In der E-Mail-Adresse fehlt ein @.',
    );
  });

  it('fängt unvollständige Adressen', () => {
    for (const bad of [
      'leon@',
      '@example.de',
      'leon@example',
      'leon@example.',
      'leon@example.d',
      'leon @example.de',
      'leon@exa mple.de',
      'leon@@example.de',
    ]) {
      expect(validateCredentials(bad, OK_PASSWORD).email, bad).toBeTruthy();
    }
  });

  /**
   * Die wichtigere Richtung: eine abgewiesene GÜLTIGE Adresse ist ein Nutzer,
   * der sich nicht anmelden kann — ein deutlich schlimmerer Fehler als eine
   * durchgelassene ungültige, die Kickbase danach ohnehin ablehnt. Deshalb ist
   * das Muster absichtlich permissiv, und deshalb steht diese Liste hier.
   */
  it('weist keine gültige Adresse ab', () => {
    for (const good of [
      'leon+kickbase@example.de',
      'leon.schaefer@example.co.uk',
      'l@e.io',
      "o'brien@example.de",
      'leon_1998@example-domain.de',
      'leon@sub.domain.example.de',
      'LEON@EXAMPLE.DE',
      'leon@example.software',
      'leon@münchen.de',
      'leon!#$%&*+-/=?^_`{|}~@example.de',
    ]) {
      expect(validateCredentials(good, OK_PASSWORD).email, good).toBeUndefined();
    }
  });

  it('begrenzt die Länge beider Felder', () => {
    // Nicht als Schutz — das ist Aufgabe des Servers — sondern damit ein
    // versehentlich ins Feld geleertes Dokument keine Megabyte-Anfrage wird.
    // 254 ist die Obergrenze aus RFC 5321.
    const long = `${'a'.repeat(250)}@example.de`;
    expect(validateCredentials(long, OK_PASSWORD).email).toBe('Diese E-Mail-Adresse ist zu lang.');
    expect(validateCredentials('leon@example.de', 'x'.repeat(201)).password).toBe(
      'Dieses Passwort ist zu lang.',
    );
  });

  it('stellt KEINE eigenen Anforderungen an das Passwort', () => {
    // Das Passwort gehört zu einem fremden Konto, dessen Regeln Kickbase
    // setzt. Eine eigene Mindestlänge oder Zeichenklassen-Regel könnte ein
    // gültiges Passwort abweisen.
    expect(validateCredentials('leon@example.de', 'x').password).toBeUndefined();
    expect(validateCredentials('leon@example.de', ' ').password).toBeUndefined();
  });
});

describe('hasErrors', () => {
  it('erkennt jedes einzelne Feld', () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ email: 'x' })).toBe(true);
    expect(hasErrors({ password: 'x' })).toBe(true);
    // Ein Feld, das ausdrücklich `undefined` trägt (so löscht LoginScreen
    // einen Fehler beim Tippen), ist kein Fehler.
    expect(hasErrors({ email: undefined, password: undefined })).toBe(false);
  });
});
