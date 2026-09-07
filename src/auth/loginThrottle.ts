/**
 * Bremse für wiederholt fehlgeschlagene Anmeldungen.
 *
 * ## Warum kein CAPTCHA
 *
 * „Spam-Schutz" heißt bei einem Formular normalerweise CAPTCHA oder Honeypot.
 * Beides passt hier nicht, und zwar nicht aus Bequemlichkeit:
 *
 *   - kickflow hat KEIN öffentliches Formular. Es gibt kein Kontaktformular,
 *     keine Registrierung, keinen Kommentar — die einzige Eingabe der ganzen
 *     App ist dieser Login, und der schreibt nichts irgendwohin, wo Spam
 *     landen könnte. Es gibt nichts zuzuspammen.
 *   - Der Login geht an eine FREMDE API (api.kickbase.com). Ein CAPTCHA davor
 *     schützt Kickbase nicht: wer Zugangsdaten durchprobieren will, spricht
 *     die API direkt an und geht nicht durch unsere Oberfläche. Es würde nur
 *     jeden echten Nutzer bei jeder Anmeldung aufhalten — und ein
 *     CAPTCHA-Anbieter bräuchte Fremd-Skripte, was die CSP (`script-src
 *     'self'`) verbietet und die Tracking-Freiheit der App beenden würde.
 *
 * Was hier tatsächlich hilft, ist eine Bremse an der Stelle, die es gibt: ein
 * Skript, das diese Oberfläche mit Zugangsdaten füttert, wird geometrisch
 * langsamer, und die fremde API bekommt keine Serie aus unserem Browser. Für
 * den Menschen, der sich zweimal vertippt, ändert sich nichts.
 *
 * ## Warum nur im Speicher
 *
 * Der Zähler lebt im Modul und überlebt keinen Reload. Das ist bewusst und
 * nicht die schwächere Variante aus Nachlässigkeit:
 *
 *   - Ein persistierter Zähler ist trivial umgangen (privates Fenster,
 *     Site-Daten löschen, ein zweiter Tab). Er würde also nicht den
 *     aufhalten, gegen den er gedacht wäre.
 *   - Er wäre ein weiterer Eintrag im localStorage — also etwas, das in die
 *     Datenschutzerklärung müsste (storage/inventory.ts erzwingt das per
 *     Test). Ein Eintrag auf dem Gerät jedes Nutzers für einen Schutz, der
 *     mit einem Klick umgangen wird, ist der schlechtere Tausch.
 *
 * Was die Bremse wirklich leistet, leistet sie auch im Speicher: sie
 * verhindert die SERIE innerhalb einer Sitzung. Wer nach jedem Versuch neu
 * lädt, ist bei ein paar Versuchen pro Minute — und damit langsamer als die
 * Bremse ihn machen würde.
 */

/**
 * Ab dem wievielten Fehlversuch überhaupt gewartet wird.
 *
 * Zwei freie Versuche, weil ein Tippfehler im Passwort der Normalfall ist und
 * nicht ein Angriff. Wer beim dritten Mal noch falsch liegt, hat das Passwort
 * nicht — dann kostet Warten nichts.
 */
export const FREE_ATTEMPTS = 2;

/** Wartezeit nach dem ersten kostenpflichtigen Fehlversuch. */
const BASE_DELAY_MS = 5_000;

/**
 * Obergrenze. Fünf Minuten sind lang genug, dass Durchprobieren sinnlos wird,
 * und kurz genug, dass jemand mit vergessenem Passwort nicht ausgesperrt
 * bleibt — er kann inzwischen bei Kickbase zurücksetzen.
 */
const MAX_DELAY_MS = 300_000;

/**
 * Wartezeit nach `failures` Fehlversuchen, in Millisekunden.
 *
 * Verdoppelt sich je Versuch: 5s, 10s, 20s, 40s … bis zur Obergrenze. Rein
 * und exportiert, damit die Kurve ohne Uhr und ohne Formular prüfbar ist.
 */
export function delayAfterFailures(failures: number): number {
  const billable = failures - FREE_ATTEMPTS;
  if (billable <= 0) return 0;
  return Math.min(BASE_DELAY_MS * 2 ** (billable - 1), MAX_DELAY_MS);
}

/** Verbleibende Wartezeit in ganzen Sekunden, aufgerundet. */
export function secondsUntil(blockedUntil: number, now: number): number {
  return Math.max(0, Math.ceil((blockedUntil - now) / 1000));
}

interface ThrottleState {
  failures: number;
  /** Zeitstempel, ab dem wieder gesendet werden darf. */
  blockedUntil: number;
}

/**
 * Modulweiter Zustand — einer pro geladener App, siehe Begründung oben.
 *
 * Bewusst kein React-State: er soll einen Wechsel auf einen anderen Screen
 * und zurück überleben. Läge er im LoginScreen, setzte ihn ein Sprung auf die
 * Datenschutzseite und zurück auf null — also gerade das, was ein Skript
 * täte.
 */
let state: ThrottleState = { failures: 0, blockedUntil: 0 };

/** Wie lange noch gewartet werden muss, in Sekunden. 0 = jetzt erlaubt. */
export function blockedForSeconds(now: number = Date.now()): number {
  return secondsUntil(state.blockedUntil, now);
}

/** Nach einem fehlgeschlagenen Versuch aufrufen. Gibt die neue Sperre in Sekunden. */
export function recordFailure(now: number = Date.now()): number {
  state = {
    failures: state.failures + 1,
    blockedUntil: now + delayAfterFailures(state.failures + 1),
  };
  return blockedForSeconds(now);
}

/**
 * Nach einer erfolgreichen Anmeldung aufrufen.
 *
 * Zurücksetzen und nicht bloß entsperren: die Zählung gehört zu „dieser
 * Browser probiert Zugangsdaten durch", und ein Erfolg widerlegt das. Wer
 * sich nach drei Tippfehlern anmeldet, soll beim nächsten Abmelden und
 * Anmelden wieder zwei freie Versuche haben.
 */
export function recordSuccess(): void {
  state = { failures: 0, blockedUntil: 0 };
}

/** Nur für Tests: den Zähler auf Anfang stellen. */
export function resetThrottle(): void {
  state = { failures: 0, blockedUntil: 0 };
}
