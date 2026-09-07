/**
 * Die kanonische Herkunft (Origin) der Auslieferung, zur Build-Zeit ermittelt.
 *
 * Vier Dinge brauchen eine ABSOLUTE URL und können sie nicht zur Laufzeit aus
 * `location` nehmen, weil sie im statischen HTML bzw. in statischen Dateien
 * stehen: `<link rel="canonical">`, `og:url`, `og:image` (relative Pfade
 * werden von einem Teil der Scraper ignoriert) und die `Sitemap:`-Zeile in
 * der robots.txt, für die die Spezifikation eine absolute URL verlangt.
 *
 * ## Warum das nicht hartkodiert ist
 *
 * Im Repository steht nirgends eine Produktionsdomain — nicht in der README,
 * nicht in vercel.json, nicht in der manifest.webmanifest. Eine hier geratene
 * Domain wäre schlimmer als keine: ein falsches `canonical` weist
 * Suchmaschinen auf eine fremde Seite, und ein falsches `og:image` liefert
 * jedem Chat-Vorschau-Bot einen 404.
 *
 * Deshalb die Kette:
 *
 *   1. `SITE_URL` — die ausdrückliche Angabe, falls eine eigene Domain im
 *      Spiel ist (`https://kickflow.example`). Gewinnt immer.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — setzt Vercel bei jedem Build selbst
 *      und zwar auf die PRODUKTIONS-Domain des Projekts, auch in einem
 *      Preview-Build. Genau das ist hier gewollt: das canonical einer Preview
 *      soll auf Produktion zeigen, nicht auf die Wegwerf-URL des Deploys.
 *      Kommt ohne Schema, deshalb das `https://` davor.
 *   3. Nichts davon gesetzt (lokaler Build) → `null`. Die Aufrufer lassen die
 *      betroffenen Angaben dann WEG, statt einen Platzhalter einzusetzen.
 *
 * Bewusst NICHT `VERCEL_URL`: das ist die Deploy-spezifische URL
 * (`kickflow-abc123-team.vercel.app`) und wechselt bei jedem Push. Als
 * canonical wäre sie eine neue, konkurrierende Adresse pro Deploy.
 */

/** Vercel setzt das auf `production`, `preview` oder `development`. */
export function isProductionDeploy(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

/**
 * Ob überhaupt auf Vercel gebaut wird. Unterscheidet „lokaler Build ohne
 * Domain" (in Ordnung) von „Vercel-Build ohne Domain" (Fehlkonfiguration, die
 * eine Warnung wert ist).
 */
export function isVercelBuild(): boolean {
  return Boolean(process.env.VERCEL);
}

/**
 * Origin ohne abschließenden Schrägstrich, z.B. `https://kickflow.example`,
 * oder `null`, wenn keine Domain bekannt ist.
 */
export function resolveSiteOrigin(): string | null {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return normalizeOrigin(explicit);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  // Vercel liefert den Host ohne Schema.
  if (vercel) return normalizeOrigin(vercel.startsWith('http') ? vercel : `https://${vercel}`);

  return null;
}

/**
 * Auf Schema + Host reduzieren und den Schrägstrich am Ende entfernen, damit
 * die Aufrufer bedenkenlos `${origin}${pfad}` schreiben können.
 *
 * `new URL()` und keine String-Operation: ein Wert mit Pfad, Query oder
 * Tippfehler (`https:/kickflow.example`) fällt hier auf, statt sich in eine
 * kaputte sitemap.xml zu schreiben. `http:` wird auf `https:` gehoben — die
 * Auslieferung ist per HSTS und `upgrade-insecure-requests` ohnehin nur über
 * HTTPS erreichbar, eine http-URL im canonical wäre also von Anfang an eine
 * Weiterleitung.
 */
function normalizeOrigin(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `SITE_URL ist keine gültige URL: ${JSON.stringify(raw)}. Erwartet z.B. https://kickflow.example`,
    );
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`SITE_URL braucht http(s), bekam: ${url.protocol}`);
  }
  return `https://${url.host}`;
}

/** Absolute URL zu einem App-Pfad, oder `null` ohne bekannte Domain. */
export function absoluteUrl(path: string): string | null {
  const origin = resolveSiteOrigin();
  if (!origin) return null;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
