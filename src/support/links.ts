/**
 * Fester Projekt-Link nach außen: die Produktseite.
 *
 * Bewusst eine Konstante und keine `VITE_*`-Variable wie SUPPORT_URL
 * (src/support/supportUrl.ts): der Spenden-Anbieter wechselt pro Umgebung und
 * darf fehlen, die Produktseite gehört zum Produkt und muss in jedem Build
 * dieselbe sein.
 *
 * HIER STAND EINMAL AUCH `PRIVACY_URL` und zeigte auf
 * codewithleon.dev/apps/kickflow-datenschutz/. Die Begründung dafür war, dass
 * beide Seiten auf codewithleon.dev gepflegt werden und die App nur verlinkt.
 * Das gilt für die Homepage weiter und für den Datenschutz nicht mehr — die
 * Erklärung liegt jetzt als eigene Route in der App
 * (src/legal/PrivacyScreen.tsx, `/datenschutz`), zusammen mit den neuen
 * Nutzungsbedingungen.
 *
 * Der Grund ist nicht Geschmack, sondern dass die Erklärung eine Tabelle
 * enthält, die aus `src/storage/inventory.ts` kommt und per Test an
 * `storage/keys.ts` gekoppelt ist: ein neuer localStorage-Schlüssel bricht
 * `npm test`, solange er dort nicht beschrieben ist. Dieselbe Auskunft auf
 * einer Seite in einem anderen Repository hätte diese Kopplung nicht — sie
 * wäre ab dem nächsten neuen Schlüssel still falsch. Dazu kommt: die
 * installierte PWA läuft standalone, ein externer Link reißt aus der App
 * heraus und ist offline gar nicht erreichbar.
 *
 * Wer die Seite auf codewithleon.dev behält, sollte sie auf `/datenschutz`
 * weiterleiten — zwei Fassungen derselben Erklärung driften sonst
 * auseinander, und das ist der Fehler, den es bei einer Rechtsseite nicht
 * geben darf.
 */
export const HOMEPAGE_URL = 'https://codewithleon.dev/apps/kickflow/';
