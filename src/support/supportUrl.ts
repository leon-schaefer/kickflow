/**
 * Ziel des „kickflow unterstützen"-Buttons im Mehr-Tab.
 *
 * Der Zugriff muss wörtlich `process.env.EXPO_PUBLIC_SUPPORT_URL` lauten:
 * Metro ersetzt `EXPO_PUBLIC_*` beim Bundling textuell durch den Wert. Ein
 * dynamischer Zugriff (`process.env[name]`) bleibt stehen und wäre zur
 * Laufzeit `undefined`.
 *
 * Nicht gesetzt = die Unterstützen-Karte rendert gar nicht. Das ist Absicht:
 * ein Spenden-Button, der ins Leere zeigt, ist schlechter als keiner. Neben-
 * effekt: der Anbieter lässt sich pro Umgebung wechseln (lokal `.env.local`,
 * Web über die Vercel-Projekt-Env-Vars, nativ über die EAS-Environments aus
 * eas.json), ohne dass ein Handle im Repo steht.
 */

/**
 * Bewusst eine String-Prüfung statt `new URL(url).protocol`: React Native
 * polyfillt `URL` global mit einer eigenen Minimalklasse
 * (react-native/Libraries/Blob/URL.js), die zwar `new URL()` versteht, aber
 * keine `protocol`-Property besitzt. Ein Protokollvergleich wäre dort immer
 * `undefined !== 'https:'` — der Button verschwände auf iOS/Android still,
 * während er im Web funktioniert.
 *
 * Kein Whitespace, kein zweites Schema: `window.open` und `Linking.openURL`
 * öffnen bereitwillig, was man ihnen gibt (`javascript:`, `file:` …). Die
 * URL kommt zwar aus der eigenen Build-Konfiguration und nicht von außen,
 * aber ein Tippfehler soll hier auffallen und nicht durchgereicht werden.
 */
const HTTPS_URL_PATTERN = /^https:\/\/[^\s/?#]+(?:[/?#]\S*)?$/i;

export function resolveSupportUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!HTTPS_URL_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export const SUPPORT_URL = resolveSupportUrl(process.env.EXPO_PUBLIC_SUPPORT_URL);
