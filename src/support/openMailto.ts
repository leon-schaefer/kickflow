/**
 * Übergibt eine mailto-URL an das Mail-Programm des Geräts.
 *
 * Bewusst `window.location.href` und NICHT `openExternalUrl` daneben, obwohl
 * beides „öffne etwas außerhalb der App" heißt:
 *
 *  - Eine mailto-URL navigiert das Dokument nicht. Der Browser gibt sie an
 *    den registrierten Handler und lässt die Seite stehen — der Grund für
 *    `window.open` (in der standalone laufenden PWA gibt es keinen Zurück-Weg)
 *    greift hier also gar nicht.
 *  - `window.open('mailto:…')` hinterlässt in Desktop-Browsern einen leeren
 *    Tab und wird auf iOS in der installierten PWA je nach Version ignoriert.
 *    `location.href` ist der Weg, den WebKit dort verlässlich behandelt.
 *
 * Ob ein Mail-Programm existiert, ist von hier aus NICHT feststellbar: ohne
 * Handler passiert schlicht nichts, ohne Fehler und ohne Event. Deshalb wird
 * der Aufrufer nach dem Aufruf nicht „gesendet" melden, sondern den
 * Kopieren-Fallback anbieten (src/screens/FeedbackScreen.tsx).
 *
 * `async` wie `openExternalUrl`, damit beide Ausgänge im Screen gleich
 * aussehen und ein Wurf (ein Browser, der die Navigation verweigert) im
 * `catch` landet.
 */
export async function openMailto(url: string): Promise<void> {
  window.location.href = url;
}
