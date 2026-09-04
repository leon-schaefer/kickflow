/**
 * Woher die Commit-SHA zur Build-Zeit kommt — eine Stelle für alle Aufrufer.
 *
 * Auf Vercel steht sie in VERCEL_GIT_COMMIT_SHA, lokal liefert sie
 * `git rev-parse`. Ohne Git-Kontext (Export aus einem Tarball) gibt es keine,
 * und das ist in Ordnung: die Build-ID trägt ihre Eindeutigkeit im
 * Zeitstempel, die SHA ist nur Herkunftsangabe.
 *
 * Gebraucht von scripts/write-build-id.ts (Build-ID) und künftig von
 * vite.config.ts (Versionsanzeige im Mehr-Tab, bisher über app.config.js und
 * expo-constants). Die Verkürzung selbst liegt in src/updates/buildId.ts, weil
 * das Build-ID-Format sie ohnehin definiert.
 */
import { execSync } from 'node:child_process';
import { shortSha } from '../src/updates/buildId.ts';

/** Die volle SHA, ungeprüft — Aufrufer entscheiden über die Verkürzung. */
export function resolveGitSha(): string | null {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

/** Sieben Zeichen, oder `null` wenn es keine verwertbare SHA gibt. */
export function resolveShortGitSha(): string | null {
  return shortSha(resolveGitSha());
}
