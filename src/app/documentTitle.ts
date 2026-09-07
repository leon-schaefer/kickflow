/**
 * Baut den `document.title` aus den Titeln der getroffenen Routen.
 *
 * Warum überhaupt pro Route: die App hatte EINEN Titel („kickflow") für alle
 * 15 Routen. Drei Stellen zeigen ihn, und an allen drei war er damit
 * nutzlos — die Tab-Leiste des Browsers bei mehreren offenen Tabs, das
 * Lesezeichen, das jemand auf den Markt-Tab setzt, und die Verlaufsliste,
 * in der 15 gleichnamige Einträge stehen.
 *
 * Getrennt von der Hook (useDocumentTitle.ts), weil das hier reine
 * String-Logik ist und ohne DOM prüfbar sein soll: die Fallunterscheidungen
 * (kein Titel, mehrere Titel, der Name selbst als Titel) sind genau die
 * Stellen, an denen so eine Funktion „kickflow – kickflow" produziert.
 */

/** Der Produktname, wie er im Titel und in der manifest.webmanifest steht. */
export const APP_NAME = 'kickflow';

/**
 * Der Titel der Startseite. Deckungsgleich mit dem `<title>` in der
 * index.html — das ist die Fassung, die ein Crawler ohne
 * JavaScript-Ausführung sieht, und sie soll sich nicht davon unterscheiden,
 * was React eine Sekunde später einsetzt.
 */
export const DEFAULT_TITLE = `${APP_NAME} – Aufstellung, Markt und Marktwerte für Kickbase`;

/**
 * Trennzeichen zwischen Seitentitel und Produktname. Ein Gedankenstrich mit
 * Leerzeichen, kein Bindestrich und kein Pipe: derselbe Strich, den die
 * index.html benutzt.
 */
const SEPARATOR = ' – ';

/**
 * `titles` sind die `handle.title`-Werte der getroffenen Routen, von außen
 * nach innen (so liefert React Router `useMatches()`). Verschachtelte Routen
 * können also mehrere beitragen; genommen wird der INNERSTE, weil er der
 * spezifischste ist.
 *
 * Kein Zusammensetzen der ganzen Kette („Liga – Markt – kickflow"): die
 * Layout-Routen der App tragen keine sinnvollen Namen (`RequireAuth`,
 * `TabsLayout` erscheinen nicht einmal in der URL), und die Liga-ID ist eine
 * Zahl, die niemandem etwas sagt.
 */
export function buildDocumentTitle(titles: readonly (string | undefined)[]): string {
  const own = titles.filter((t): t is string => Boolean(t?.trim())).at(-1)?.trim();

  // Keine Route hat einen Titel — der Catch-All etwa, bis NotFound greift.
  if (!own) return DEFAULT_TITLE;

  // Der Startseiten-Titel enthält den Produktnamen schon; „kickflow – … –
  // kickflow" wäre der klassische Doppelungsfehler.
  if (own === DEFAULT_TITLE || own === APP_NAME) return DEFAULT_TITLE;

  return `${own}${SEPARATOR}${APP_NAME}`;
}
