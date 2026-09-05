/**
 * Ziel des „kickflow unterstützen"-Buttons im Mehr-Tab.
 *
 * Der Zugriff muss wörtlich `import.meta.env.VITE_SUPPORT_URL` lauten: Vite
 * ersetzt `VITE_*` beim Bundling textuell durch den Wert. Ein dynamischer
 * Zugriff (`import.meta.env[name]`) bleibt stehen und wäre im Produktions-
 * Bundle `undefined`. `process.env` gibt es hier NICHT — Vite baut keinen
 * process-Shim ins Browser-Bundle, und weil dieser Zugriff auf Modulebene
 * steht, knallte es schon beim Import.
 *
 * Nicht gesetzt = die Unterstützen-Karte rendert gar nicht. Das ist Absicht:
 * ein Spenden-Button, der ins Leere zeigt, ist schlechter als keiner. Neben-
 * effekt: der Anbieter lässt sich pro Umgebung wechseln (lokal `.env.local`,
 * im Deploy über die Vercel-Projekt-Env-Vars), ohne dass ein Handle im Repo
 * steht.
 */

/**
 * Eine String-Prüfung und nicht `new URL(url).protocol`. Der ursprüngliche
 * Grund ist mit React Native weg (dessen URL-Polyfill kannte keine
 * `protocol`-Property, ein Protokollvergleich war dort immer
 * `undefined !== 'https:'`). Sie bleibt trotzdem, weil sie mehr prüft als ein
 * Protokollvergleich: kein Whitespace, kein zweites Schema, ein Host muss da
 * sein.
 *
 * `window.open` öffnet bereitwillig, was man ihm gibt (`javascript:`,
 * `file:` …). Die URL kommt zwar aus der eigenen Build-Konfiguration und
 * nicht von außen, aber ein Tippfehler soll hier auffallen und nicht
 * durchgereicht werden.
 */
const HTTPS_URL_PATTERN = /^https:\/\/[^\s/?#]+(?:[/?#]\S*)?$/i;

export function resolveSupportUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!HTTPS_URL_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export const SUPPORT_URL = resolveSupportUrl(import.meta.env.VITE_SUPPORT_URL);
