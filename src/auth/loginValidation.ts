/**
 * Prüfung der Login-Eingaben, bevor sie an Kickbase gehen.
 *
 * Vorher gab es genau eine Regel: beide Felder nicht leer (`canSubmit` in
 * LoginScreen). Ein Tippfehler in der Adresse — ein fehlendes `@`, ein
 * `.de` das `.d` heißt, ein mitkopiertes Leerzeichen — lief damit als
 * Anfrage zu Kickbase und kam als „Anmeldung fehlgeschlagen." zurück. Diese
 * Meldung sagt nichts darüber, WAS falsch war, und sie steht unter dem
 * Formular statt an dem Feld, das sie betrifft.
 *
 * Zwei Dinge gewinnt die Prüfung deshalb, und keins davon ist Kosmetik:
 *
 *   1. Der Hinweis steht am richtigen Feld und benennt den Fehler. Wer sich
 *      vertippt hat, sieht das, statt sein Passwort zu verdächtigen.
 *   2. Eine Anfrage, die ohnehin scheitern muss, wird gar nicht gestellt —
 *      sie zählt sonst gegen die Fehlversuche in loginThrottle.ts und
 *      belastet eine fremde API.
 *
 * Rein und ohne DOM, damit die Regeln ohne Formular prüfbar sind.
 */

export interface LoginFieldErrors {
  email?: string;
  password?: string;
}

/**
 * Absichtlich PERMISSIV: ein Zeichen, `@`, ein Zeichen, `.`, mindestens zwei
 * Zeichen — und nirgends Whitespace.
 *
 * Die Versuchung ist, hier RFC 5322 nachzubauen. Das ist der falsche
 * Kompromiss: die strengen Muster, die im Netz herumgehen, weisen gültige
 * Adressen ab (Plus-Adressen, neue TLDs, Umlaut-Domains), und eine
 * abgewiesene gültige Adresse ist ein Nutzer, der sich NICHT anmelden kann —
 * ein deutlich schlimmerer Fehler als eine durchgelassene ungültige, die
 * Kickbase dann sowieso ablehnt.
 *
 * Gefangen werden soll genau die Klasse von Fehlern, die man am Feld sofort
 * erklären kann: kein `@`, keine Punkt-Endung, Leerzeichen mitkopiert.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Obergrenze für beide Felder.
 *
 * Nicht als Schutz gedacht — der Server ist die Instanz, die Grenzen
 * durchsetzt — sondern damit ein versehentlich in ein Feld geleertes
 * Dokument nicht als Megabyte-Anfrage rausgeht. 254 ist die maximale Länge
 * einer E-Mail-Adresse nach RFC 5321.
 */
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 200;

export function validateCredentials(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  // Getrimmt geprüft, weil der Aufrufer getrimmt sendet (siehe LoginScreen):
  // sonst meldet die Prüfung einen Fehler, den das Absenden nicht mehr hätte.
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = 'Bitte gib deine E-Mail-Adresse ein.';
  } else if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
    errors.email = 'Diese E-Mail-Adresse ist zu lang.';
  } else if (!trimmedEmail.includes('@')) {
    // Eigener Fall vor dem allgemeinen: das ist der häufigste Tippfehler, und
    // „Es fehlt ein @" ist eine Anweisung, während „ungültige Adresse" nur
    // ein Urteil ist.
    errors.email = 'In der E-Mail-Adresse fehlt ein @.';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Diese E-Mail-Adresse sieht nicht vollständig aus.';
  }

  if (!password) {
    errors.password = 'Bitte gib dein Passwort ein.';
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = 'Dieses Passwort ist zu lang.';
  }
  // KEINE Mindestlänge und keine Zeichenklassen-Regel: das Passwort gehört zu
  // einem fremden Konto, dessen Regeln Kickbase setzt. Eine eigene Regel hier
  // könnte ein gültiges Passwort abweisen — und Kickbase hat sie beim Anlegen
  // schon durchgesetzt.

  return errors;
}

/** Ob überhaupt ein Fehler vorliegt. */
export function hasErrors(errors: LoginFieldErrors): boolean {
  return Boolean(errors.email || errors.password);
}
