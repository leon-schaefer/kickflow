/**
 * Build-ID-Format für `public/build-id.txt` — der Marker, an dem
 * `public/register-sw.js` erkennt, dass ein offen gebliebenes PWA-Tab auf
 * einem alten Deploy sitzt (siehe Kommentar dort).
 *
 * Warum nicht (nur) die Commit-SHA: eine SHA ändert sich nur, wenn sich der
 * Commit ändert. Ein Redeploy desselben Commits — Vercel-Rollback, Rebuild
 * nach geänderter Env-Variable, "Redeploy" im Dashboard — liefert dann eine
 * identische Build-ID, und offene Tabs bekommen kein Update-Signal, obwohl
 * sich die ausgelieferten Bundles sehr wohl geändert haben können. Der
 * Zeitstempel ist pro Build garantiert neu; die verkürzte SHA hängt nur noch
 * als Herkunftsangabe dran (praktisch beim Debuggen: "welcher Commit läuft
 * gerade live?") und darf fehlen, wenn kein Git-Kontext da ist.
 *
 * Format: `20260901T184227Z` bzw. `20260901T184227Z-bc0c043`. Sortierbar,
 * ohne Trennzeichen-Rauschen und kurz genug, um es in einer Konsolenzeile zu
 * lesen.
 */

/**
 * Erkennt eine von `formatBuildId` erzeugte Build-ID. `register-sw.js` prüft
 * dieselbe Form, um die Vercel-SPA-Rewrite-Falle abzufangen: fehlt
 * `build-id.txt` im Deploy, antwortet der Rewrite aus vercel.json mit
 * `index.html` und Status 200 — ohne Formatprüfung würde eine komplette
 * HTML-Seite als Build-ID durchgehen.
 */
export const BUILD_ID_PATTERN = /^\d{8}T\d{6}Z(?:-[0-9a-f]{7,40})?$/;

export function isBuildId(text: string | null | undefined): boolean {
  return typeof text === 'string' && BUILD_ID_PATTERN.test(text);
}

/**
 * `sha` ist optional — ohne Git-Kontext (lokaler Export aus einem Tarball)
 * trägt der Zeitstempel die Eindeutigkeit allein.
 */
export function formatBuildId(now: number, sha?: string | null): string {
  const timestamp = new Date(now)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const shortSha = normalizeSha(sha);
  return shortSha ? `${timestamp}-${shortSha}` : timestamp;
}

function normalizeSha(sha: string | null | undefined): string | null {
  if (!sha) return null;
  const trimmed = sha.trim().toLowerCase();
  // Vercel setzt VERCEL_GIT_COMMIT_SHA auch in Preview-Deploys ohne Git-Push
  // gelegentlich leer oder mit Platzhaltern — alles, was keine Hex-SHA ist,
  // fällt hier still raus, statt eine unparsebare Build-ID zu erzeugen.
  if (!/^[0-9a-f]{7,40}$/.test(trimmed)) return null;
  return trimmed.slice(0, 7);
}
