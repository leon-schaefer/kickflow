/**
 * Die Pfade der beiden Rechtsseiten, an einer Stelle.
 *
 * Warum eigene Konstanten und nicht die Strings an den vier Fundstellen
 * (Route-Baum, Login-Fuß, Mehr-Tab, sitemap.xml): diese URLs sind das, was in
 * einem Impressum, in einem App-Store-Formular und in Lesezeichen landet.
 * Sie zu ändern ist teuer, und ein Tippfehler an einer der Fundstellen führt
 * auf den 404 — bei genau den zwei Seiten, deren Erreichbarkeit rechtlich
 * gefordert ist.
 *
 * Deutsch, weil die App deutsch ist und die URL mitliest.
 */
export const PRIVACY_PATH = '/datenschutz';
export const TERMS_PATH = '/nutzungsbedingungen';

/**
 * Die Titel — geteilt zwischen Kopfzeile, `document.title` (siehe
 * src/app/routeTitles.ts) und den Links, die auf die Seiten zeigen.
 */
export const PRIVACY_TITLE = 'Datenschutz';
export const TERMS_TITLE = 'Nutzungsbedingungen';
