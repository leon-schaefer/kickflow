/**
 * Die eigene Herkunft (`https://host`) zur BUILD-Zeit — für die absoluten URLs
 * im HTML-Kopf.
 *
 * Warum das überhaupt jemand auflösen muss: `og:image` und `og:url` dürfen
 * laut Open-Graph-Protokoll nicht relativ sein, und die Scraper von WhatsApp,
 * Discord und Reddit lösen einen relativen Pfad nicht zuverlässig auf. Ein
 * `/og-image.png` im Tag bedeutet in der Praxis: Vorschaukarte ohne Bild — und
 * zwar still, denn im Browser fällt nichts aus.
 *
 * Die Reihenfolge der Quellen ist die Aussage:
 *
 *   1. `VITE_SITE_URL` — die Hand am Steuer. Nötig, sobald die App unter einer
 *      Domain läuft, die Vercel nicht als Produktions-Domain des Projekts
 *      kennt.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — setzt Vercel in JEDEM Build selbst,
 *      auch im Preview, und zwar auf die Produktions-Domain des Projekts (ohne
 *      Schema). Genau das ist der richtige Wert für eine Vorschaukarte: geteilt
 *      werden Produktions-Links, nicht Previews. Damit stimmt der Wert im
 *      Deploy ohne jede Konfiguration.
 *   3. Lokal: `http://localhost:4173`, die Adresse aus
 *      scripts/verify/serve-dist.mjs. Ein lokaler Build ist kein Deploy, die
 *      Vorschaukarte dort niemandes Problem.
 *
 * Im Vercel-Build ohne auflösbaren Wert wird NICHT auf localhost
 * zurückgefallen, sondern geworfen. Ein Deploy, dessen Vorschaukarte auf
 * localhost zeigt, sähe in CI, im Browser und in den Tests fehlerfrei aus und
 * fiele erst auf, wenn jemand den Link teilt — also genau dann, wenn es zählt.
 * Ein roter Build ist billiger.
 */

/** Fallback für Builds außerhalb von Vercel — die Adresse von serve-dist.mjs. */
export const LOCAL_ORIGIN = 'http://localhost:4173';

export interface SiteOriginEnv {
  VITE_SITE_URL?: string | undefined;
  VERCEL_PROJECT_PRODUCTION_URL?: string | undefined;
  /** Von Vercel in jedem Build gesetzt („1"). Unterscheidet Deploy von lokal. */
  VERCEL?: string | undefined;
}

/**
 * `new URL(...).origin` und keine eigene Regex: das wirft bei Unsinn, wirft
 * einen Pfad, einen Port-Tippfehler und eine angehängte Query weg und liefert
 * garantiert eine Herkunft ohne Schrägstrich am Ende. Die Tags darunter hängen
 * ihren Pfad selbst an.
 */
function toOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // Vercel liefert den Host OHNE Schema — ein blanker Host ist für `new URL`
  // aber keine gültige URL, deshalb hier ergänzt.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

export function resolveSiteOrigin(env: SiteOriginEnv): string {
  const explicit = env.VITE_SITE_URL ? toOrigin(env.VITE_SITE_URL) : null;
  if (explicit) return explicit;

  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL
    ? toOrigin(env.VERCEL_PROJECT_PRODUCTION_URL)
    : null;
  if (vercel) return vercel;

  if (env.VERCEL) {
    throw new Error(
      'Keine Herkunft für die Open-Graph-Tags: weder VITE_SITE_URL noch ' +
        'VERCEL_PROJECT_PRODUCTION_URL ist gesetzt (oder der Wert ist keine gültige URL). ' +
        'VITE_SITE_URL in den Vercel-Projekt-Env-Vars setzen — siehe scripts/siteOrigin.ts.',
    );
  }

  return LOCAL_ORIGIN;
}
