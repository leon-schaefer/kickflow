/**
 * Die localStorage-Schlüssel der App, an einer Stelle.
 *
 * Warum das ein eigenes Modul mit Test ist: bis zur Migration liefen diese
 * Werte über `@react-native-async-storage/async-storage`. Dessen
 * Web-Implementierung reicht den Schlüssel unverändert an
 * `window.localStorage` weiter (siehe `lib/module/AsyncStorage.js`, kein
 * Prefix) — der Umstieg auf rohes localStorage ist deshalb datenkompatibel.
 *
 * Genau das macht einen Tippfehler hier aber teuer: ein geänderter Schlüssel
 * wirft keinen Fehler, er findet nur nichts mehr. Jeder Nutzer verlöre still
 * seine Aufstellungs-Regeln, seine Verkaufs-Ausschlüsse und die „Zuletzt
 * genutzt"-Markierung. Deshalb sind die Strings hier wörtlich festgelegt und
 * in keys.test.ts wörtlich geprüft.
 */

/** Anmeldung: Token und Refresh-Token. Siehe src/auth/tokenStore.ts. */
export const SESSION_KEY = 'kickflow.session.v1';

/** Zuletzt benutzte Liga — nur für das Badge im Ligen-Picker, kein Auto-Resume. */
export const LAST_LEAGUE_KEY = 'kickflow.lastLeagueId';

/** Optimizer-Regeln, pro Liga. */
export function leagueRulesKey(leagueId: string): string {
  return `kickflow.rules.v1.${leagueId}`;
}

/** Vom Verkauf ausgeschlossene Spieler, pro Liga. */
export function excludedFromSaleKey(leagueId: string): string {
  return `kickflow.excludedFromSale.v1.${leagueId}`;
}

/**
 * Merker, dass der Installations-Hinweis (src/pwa/) einmal gezeigt wurde.
 * Absichtlich EIN Flag ohne Zähler: der Hinweis erscheint genau einmal.
 */
export const INSTALL_HINT_KEY = 'kickflow.installHint.v1';
