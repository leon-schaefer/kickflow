/**
 * Feste Projekt-Links: Produktseite und Datenschutzerklärung.
 *
 * Bewusst Konstanten und keine `EXPO_PUBLIC_*`-Variablen wie SUPPORT_URL
 * (src/support/supportUrl.ts): der Spenden-Anbieter wechselt pro Umgebung und
 * darf fehlen, diese beiden gehören zum Produkt und müssen in jedem Build
 * dieselben sein. Ein Datenschutz-Link, der je nach Environment verschwindet,
 * wäre für App Store und DSGVO ein Problem.
 *
 * Beide Seiten sind Teil von codewithleon.dev und werden dort gepflegt — die
 * App verlinkt nur, sie rendert keine eigene Datenschutzerklärung.
 */
export const HOMEPAGE_URL = 'https://codewithleon.dev/apps/kickflow/';
export const PRIVACY_URL = 'https://codewithleon.dev/apps/kickflow-datenschutz/';
