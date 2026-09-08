/**
 * Feste Projekt-Adressen: Produktseite und Feedback-Postfach.
 *
 * Bewusst Konstanten und keine `VITE_*`-Variablen wie SUPPORT_URL
 * (src/support/supportUrl.ts): der Spenden-Anbieter wechselt pro Umgebung und
 * darf fehlen, diese beiden gehören zum Produkt und müssen in jedem Build
 * dieselben sein.
 *
 * HIER STAND EINMAL AUCH `PRIVACY_URL` und zeigte auf
 * codewithleon.dev/apps/kickflow-datenschutz/. Die Begründung dafür war, dass
 * beide Seiten auf codewithleon.dev gepflegt werden und die App nur verlinkt.
 * Das gilt für die Homepage weiter und für den Datenschutz nicht mehr — die
 * Erklärung liegt jetzt als eigene Route in der App
 * (src/legal/PrivacyScreen.tsx, `/datenschutz`), zusammen mit den neuen
 * Nutzungsbedingungen.
 *
 * Der Grund ist nicht Geschmack. Die Erklärung enthält eine Tabelle, die aus
 * `src/storage/inventory.ts` kommt und per Test an `storage/keys.ts` gekoppelt
 * ist: ein neuer localStorage-Schlüssel bricht `npm test`, solange er dort
 * nicht beschrieben ist. Dieselbe Auskunft auf einer Seite in einem anderen
 * Repository hätte diese Kopplung nicht — sie wäre ab dem nächsten neuen
 * Schlüssel still falsch. Dazu kommt: die installierte PWA läuft standalone,
 * ein externer Link reißt aus der App heraus und ist offline gar nicht
 * erreichbar.
 *
 * Wer die Seite auf codewithleon.dev behält, sollte sie auf `/datenschutz`
 * weiterleiten — zwei Fassungen derselben Erklärung driften sonst
 * auseinander, und das ist der Fehler, den es bei einer Rechtsseite nicht
 * geben darf.
 */
export const HOMEPAGE_URL = 'https://codewithleon.dev/apps/kickflow/';

/**
 * Empfänger des Feedback-Formulars (src/screens/FeedbackScreen.tsx) — aus
 * demselben Grund eine Konstante: ein Feedback-Weg, der je nach Environment
 * fehlt, ist keiner. Die Adresse ist damit im Bundle öffentlich; das ist sie
 * als Kontaktadresse eines Produkts ohnehin.
 *
 * Postfach auf derselben Domain wie die Homepage. Wird hier eine andere
 * eingetragen, muss sie EXISTIEREN — die App kann nicht erkennen, ob eine Mail
 * ankommt, und stilles Verschwinden ist der schlechteste Fehlerfall, den ein
 * Feedback-Formular haben kann.
 */
export const FEEDBACK_EMAIL = 'feedback@codewithleon.dev';

/**
 * Das öffentliche Repository. Verlinkt auf der Startseite
 * (src/screens/LandingScreen.tsx), und zwar im selben Fuß wie die Homepage.
 *
 * Für diese Seite ist der Link mehr als ein Verweis: sie wirbt damit, dass
 * kickflow ohne eigenen Server auskommt, nichts nachlädt und nicht trackt —
 * drei Behauptungen, die ein Besucher nirgends nachprüfen kann. Am Quellcode
 * kann er sie prüfen. Ein Absatz über Vertrauen ohne den Link daneben ist die
 * schwächere Fassung derselben Aussage.
 *
 * Nur `owner/repo` und kein Deep-Link auf eine Datei oder einen Branch: der
 * Pfad wäre der Teil, der beim ersten Umbau still ins Leere zeigt.
 */
export const REPOSITORY_URL = 'https://github.com/leon-schaefer/kickflow';
