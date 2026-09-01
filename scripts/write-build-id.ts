/**
 * Schreibt public/build-id.txt vor jedem Web-Export. public/register-sw.js
 * verglich bisher den Dateinamen des geladenen JS-Bundles
 * (`/_expo/static/js/web/entry-<hash>.js`) gegen eine frisch geholte
 * index.html, um ein offen gebliebenes PWA-Tab auf einen Redeploy hinzuweisen.
 * Das koppelt den Update-Check an Expos Ausgabepfad — ändert sich der (z. B.
 * durch Code-Splitting oder ein Bundler-Update), greift der Selektor nicht
 * mehr und der Check registriert sich still nie wieder.
 *
 * build-id.txt ist ein von Expo unabhängiger, expliziter Marker für "welcher
 * Deploy läuft gerade" und macht register-sw.js robust gegen solche Änderungen.
 *
 * Wert: Vercels eigene Commit-SHA-Env-Variable, sonst `git rev-parse`, sonst
 * ein Timestamp als letzter Fallback (z. B. lokaler Export ohne Git-Kontext).
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

function resolveBuildId(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return `local-${Date.now()}`;
  }
}

const buildId = resolveBuildId();
const outPath = path.join(__dirname, '..', 'public', 'build-id.txt');
writeFileSync(outPath, buildId);
console.log(`build-id.txt geschrieben: ${buildId}`);
