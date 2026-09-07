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

/**
 * Gemeinsames Präfix ALLER Schlüssel dieser App.
 *
 * Zwei Dinge hängen daran, und beide brauchen es, weil die Schlüsselmenge
 * nicht endlich ist: `leagueRulesKey` und `excludedFromSaleKey` bauen ihren
 * Namen aus einer Liga-ID, es gibt also so viele wie der Nutzer Ligen hat.
 * Eine Liste zum Durchlaufen kann es damit nicht geben — nur das Präfix.
 *
 *   1. `localStore.clearAppData()` löscht darüber alles, was kickflow
 *      angelegt hat (Datenschutz-Auskunft, siehe SettingsScreen).
 *   2. `storage/inventory.ts` beschreibt darüber, was gespeichert wird, für
 *      die Datenschutzerklärung.
 *
 * Das Präfix ist DEFINIEREND, nicht beschreibend: keys.test.ts prüft, dass
 * jeder Schlüssel damit anfängt. Ein Schlüssel ohne Präfix wäre von beidem
 * ausgenommen — er würde beim Löschen liegen bleiben und in der
 * Datenschutzerklärung fehlen.
 */
export const APP_KEY_PREFIX = 'kickflow.';

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
