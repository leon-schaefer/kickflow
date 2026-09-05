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
 * Wert: Build-Zeitstempel, plus die verkürzte Commit-SHA als Herkunftsangabe,
 * falls es eine gibt (Vercels VERCEL_GIT_COMMIT_SHA, sonst `git rev-parse`).
 * Warum der Zeitstempel führt und die SHA allein nicht reicht: siehe
 * src/updates/buildId.ts.
 *
 * Läuft über `npm run build:web` — Vercel ruft dasselbe Script über
 * buildCommand in vercel.json auf. Ohne diesen Schritt fehlt build-id.txt im
 * Deploy und der SPA-Rewrite liefert stattdessen index.html aus.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { formatBuildId } from '../src/updates/buildId';
import { resolveGitSha } from './gitSha';

const buildId = formatBuildId(Date.now(), resolveGitSha());
const outPath = path.join(import.meta.dirname, '..', 'public', 'build-id.txt');
writeFileSync(outPath, buildId);
console.log(`build-id.txt geschrieben: ${buildId}`);
