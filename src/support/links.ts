/**
 * Feste Projekt-Adressen: Produktseite, Datenschutzerklärung und das
 * Feedback-Postfach.
 *
 * Bewusst Konstanten und keine `VITE_*`-Variablen wie SUPPORT_URL
 * (src/support/supportUrl.ts): der Spenden-Anbieter wechselt pro Umgebung und
 * darf fehlen, diese drei gehören zum Produkt und müssen in jedem Build
 * dieselben sein. Ein Datenschutz-Link, der je nach Environment verschwindet,
 * wäre für die DSGVO ein Problem.
 *
 * Beide Seiten sind Teil von codewithleon.dev und werden dort gepflegt — die
 * App verlinkt nur, sie rendert keine eigene Datenschutzerklärung.
 */
export const HOMEPAGE_URL = 'https://codewithleon.dev/apps/kickflow/';
export const PRIVACY_URL = 'https://codewithleon.dev/apps/kickflow-datenschutz/';

/**
 * Empfänger des Feedback-Formulars (src/screens/FeedbackScreen.tsx) — aus
 * demselben Grund eine Konstante: ein Feedback-Weg, der je nach Environment
 * fehlt, ist keiner. Die Adresse ist damit im Bundle öffentlich; das ist sie
 * als Kontaktadresse eines Produkts ohnehin.
 *
 * Postfach auf derselben Domain wie Homepage und Datenschutz. Wird hier eine
 * andere eingetragen, muss sie EXISTIEREN — die App kann nicht erkennen, ob
 * eine Mail ankommt, und stilles Verschwinden ist der schlechteste
 * Fehlerfall, den ein Feedback-Formular haben kann.
 */
export const FEEDBACK_EMAIL = 'feedback@codewithleon.dev';
