/**
 * Welcher Installations-Hinweis passt — die ganze Entscheidung an einer
 * Stelle und ohne Zugriff auf `window`, damit sie ohne DOM prüfbar bleibt
 * (installHint.test.ts). Die Umgebung liest `useInstallHint.ts` aus und
 * reicht sie hier als Eingabe herein.
 *
 * Warum überhaupt zwei Varianten: „Installieren" ist auf den beiden
 * Plattformen etwas grundverschiedenes. Chromium (Android, Desktop) meldet
 * die Installierbarkeit über `beforeinstallprompt` an und installiert auf
 * Knopfdruck — dort ist ein Button richtig und eine Anleitung falsch, weil
 * die Menüpunkte je nach Browser anders heißen. WebKit auf iOS kennt das
 * Event nicht und wird es auch nicht bekommen; dort führt der einzige Weg
 * über das Teilen-Menü, also über eine Anleitung.
 */

export type InstallHintKind =
  /** Chromium: `beforeinstallprompt` liegt vor, ein Button genügt. */
  | 'native'
  /** iOS/iPadOS: Anleitung über „Teilen" → „Zum Home-Bildschirm". */
  | 'ios'
  /** Android ohne abgefangenes Event (Firefox u. a.): Anleitung übers Menü. */
  | 'android';

export interface InstallHintInput {
  /** Läuft schon vom Startbildschirm — dann gibt es nichts zu installieren. */
  standalone: boolean;
  /** Hinweis wurde bereits gezeigt (localStorage, siehe useInstallHint.ts). */
  seen: boolean;
  /** Ein abgefangenes `beforeinstallprompt` liegt bereit. */
  hasPrompt: boolean;
  userAgent: string;
  /** Für die iPadOS-Erkennung, siehe `isIosDevice`. */
  maxTouchPoints: number;
}

/**
 * iPadOS meldet sich seit Version 13 als „Macintosh" — der einzige
 * verlässliche Unterschied zum echten Mac sind die Touchpunkte. Ohne diesen
 * Zweig bekäme das iPad gar keinen Hinweis, obwohl es die PWA installieren
 * kann.
 */
export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function isAndroidDevice(userAgent: string): boolean {
  return /Android/.test(userAgent);
}

/**
 * `null` heißt: nichts zeigen. Das ist der Normalfall auf dem Desktop ohne
 * Chromium — einen Hinweis zu zeigen, dem keine Möglichkeit zum Installieren
 * gegenübersteht, wäre schlimmer als keiner.
 *
 * Die Reihenfolge ist die Aussage: `standalone` und `seen` schlagen alles,
 * und das abgefangene Event schlägt jede Anleitung. Ein Android-Chrome, in
 * dem das Event (noch) nicht kam, bekommt die Menü-Anleitung; trifft das
 * Event später ein, wechselt der Dialog auf den Button — genau richtig herum,
 * denn der Button ist der kürzere Weg.
 */
export function installHintKind({
  standalone,
  seen,
  hasPrompt,
  userAgent,
  maxTouchPoints,
}: InstallHintInput): InstallHintKind | null {
  if (standalone || seen) return null;
  if (hasPrompt) return 'native';
  if (isIosDevice(userAgent, maxTouchPoints)) return 'ios';
  if (isAndroidDevice(userAgent)) return 'android';
  return null;
}
