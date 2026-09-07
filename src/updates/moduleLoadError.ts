/**
 * Erkennt einen fehlgeschlagenen dynamischen Import — den Fehler, den eine
 * lange offene PWA nach einem Redeploy bekommt.
 *
 * ## Warum das ein eigener Fall ist
 *
 * Die Screens hängen an `lazy(() => import(...))` (src/routes/routes.tsx),
 * ihre Chunks tragen einen Content-Hash im Namen. Nach einem Deploy liegen
 * unter den ALTEN Namen keine Dateien mehr. Eine PWA, die seit Tagen offen
 * ist, kennt aber nur die alten Namen: der erste Tap auf einen Tab, dessen
 * Chunk noch nicht im Service-Worker-Cache liegt, holt sich damit einen 404
 * und der Import lehnt ab.
 *
 * Ohne eigenen Zweig ist das das Ende der Sitzung: React Router fängt den
 * Fehler in seiner Default-ErrorBoundary und ersetzt die GANZE App durch
 * „Unexpected Application Error!" — englisch, ohne Weg zurück, ohne Tab-Leiste
 * (am Route-Baum nachgestellt, siehe src/routes/appError.test.tsx). Dabei ist
 * die Lage harmlos und die Abhilfe eine Zeile: neu laden. Die index.html wird
 * network-first ausgeliefert (public/sw.js), der Reload bringt also die neuen
 * Chunk-Namen mit.
 *
 * ## Warum eine Textprüfung
 *
 * Der Fehler hat keinen Typ und keinen Code, nur eine Meldung, und die
 * schreibt jede Engine anders:
 *
 *   Chromium  „Failed to fetch dynamically imported module: <url>"
 *   WebKit    „Importing a module script failed."
 *   Firefox   „error loading dynamically imported module"
 *
 * Deshalb drei Muster statt eines. Trifft keines, ist es ein anderer Fehler
 * und wird auch als solcher gezeigt — die Fehlerseite hat für beide Fälle
 * einen Text.
 */
const PATTERNS = [
  /dynamically imported module/i,
  /importing a module script failed/i,
  /failed to (fetch|load) module/i,
];

export function isModuleLoadError(error: unknown): boolean {
  const message = messageOf(error);
  if (message === null) return false;
  return PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Die Meldung samt `cause`-Kette. Vite und der Modulrunner verpacken den
 * ursprünglichen Fehler gelegentlich in einen eigenen; ohne die Kette wäre
 * die Erkennung von der Verpackung abhängig.
 */
function messageOf(error: unknown, depth = 0): string | null {
  if (depth > 3) return null;
  if (typeof error === 'string') return error;
  if (!(error instanceof Error)) return null;
  const cause = messageOf(error.cause, depth + 1);
  return cause === null ? error.message : `${error.message}\n${cause}`;
}
