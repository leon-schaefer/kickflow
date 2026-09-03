/**
 * Beantwortet die Frage "passt der lokale Code noch zum installierten Binary?"
 * — also: reicht ein OTA-Update, oder braucht es einen neuen Build?
 *
 * Zwei Aufrufmodi:
 *   - blockierend (Default): läuft über die npm-pre-Hooks vor `eas update` und
 *     bricht bei Abweichung ab.
 *   - `--report-only`: bricht nie ab, schreibt stattdessen `ota-possible` und
 *     `build-platform` nach $GITHUB_OUTPUT (siehe unten). Damit entscheidet
 *     .github/workflows/release.yml zwischen OTA und neuem Build.
 *
 * Warum das nötig ist: `eas update` hasht die runtimeVersion aus dem
 * Projektbaum, in dem es läuft, `eas build` aus dem, was der Build-Server nach
 * `npm ci` vorfindet. Weichen die auseinander, wird das Update mit einer
 * runtimeVersion veröffentlicht, die kein installiertes Binary anfragt —
 * expo-updates liefert dann einfach nichts aus. Kein Fehler, keine Warnung,
 * das Update existiert nur für ein Binary, das es nicht gibt.
 *
 * Genau das ist am 03.09.2026 passiert: expo-observe (plus die transitive
 * expo-app-metrics) standen in package.json und package-lock.json, waren aber
 * lokal nicht installiert. Ohne die beiden fehlten ihre Einträge im
 * iOS-Autolinking-Config, der Hash fiel auf den Stand *vor* dem Observe-Commit
 * zurück (8c1325a2 statt 1f3de806) und die Updates landeten auf der
 * runtimeVersion eines zwei Tage alten Builds. Ein vergessenes `npm install`
 * reicht also — deshalb der Check.
 *
 * Der Kanal kommt aus npm_lifecycle_event (preupdate:testflight -> testflight),
 * `--channel <name>` überschreibt das.
 *
 * Bewusst für eine ältere runtimeVersion publishen (etwa einen Fix für ein noch
 * verbreitetes Binary nachschieben): SKIP_FINGERPRINT_CHECK=1 setzen. Im
 * report-only-Modus wirkt das nicht — dort gibt es nichts zu überspringen.
 *
 * iOS und Android werden getrennt bewertet, denn beide haben ihren eigenen
 * Fingerprint und ihren eigenen Build-Stand. Der report-only-Modus meldet
 * deshalb zwei unabhängige Dinge:
 *
 *   ota-possible   – mindestens eine Plattform hat auf dem Kanal ein fertiges
 *                    Binary mit passendem Fingerprint. Ein `eas update`
 *                    publiziert ohnehin eine Update-Gruppe für alle
 *                    Plattformen, jede mit ihrer eigenen runtimeVersion;
 *                    es lohnt sich, sobald irgendwer es anfragt.
 *   build-platform  – "ios", "android", "all" oder leer: die Plattformen, die
 *                    ein neues Binary brauchen, weil ihr Fingerprint vom
 *                    letzten fertigen Build abweicht oder es dort noch gar
 *                    keinen gibt.
 *
 * Beides kann gleichzeitig zutreffen, und genau dafür ist die Trennung da: vor
 * dem ersten Android-Release passt iOS längst zum letzten Build (OTA reicht),
 * während Android überhaupt erst gebaut werden muss. Eine gemeinsame
 * Ja/Nein-Antwort für beide Plattformen würde hier entweder das iOS-OTA
 * blockieren oder den Android-Build nie starten.
 *
 * Nicht gebaut wird, was schon baut: läuft für den aktuellen Fingerprint
 * bereits ein Build in der Queue, wäre ein zweiter reine Verschwendung —
 * Buildminuten plus eine verbrannte Buildnummer, denn appVersionSource
 * "remote" zählt bei jedem Start hoch. Genau das passierte beim Einrichten:
 * Build 13 und 14 gingen für dieselbe Änderung raus, weil ein Push während
 * eines laufenden Builds nur die *fertigen* Builds betrachtete und den
 * laufenden übersah.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const PLATFORMS = ['ios', 'android'] as const;
type Platform = (typeof PLATFORMS)[number];

// Muss zu den --environment-Flags der update:*-Scripts in package.json passen:
// eas wertet die App-Config mit den Env-Vars dieses Environments aus, ein
// anderes Environment kann damit einen anderen Fingerprint ergeben.
const CHANNEL_ENVIRONMENTS: Record<string, string> = {
  preview: 'preview',
  testflight: 'production',
  production: 'production',
};

type Build = {
  id: string;
  status: string;
  appBuildVersion: string | null;
  updateChannel: { name: string } | null;
  fingerprint: { hash: string } | null;
};

// Ein Build in einem dieser Zustände ist noch unterwegs und wird für den Kanal
// ein Binary hinterlassen; ein weiterer für denselben Code wäre redundant.
const PENDING_STATES = ['NEW', 'IN_QUEUE', 'IN_PROGRESS'];

type Result =
  | { platform: Platform; state: 'no-build' }
  | { platform: Platform; state: 'pending'; hash: string; label: string }
  | { platform: Platform; state: 'match'; hash: string; label: string }
  | { platform: Platform; state: 'mismatch'; buildHash: string; local: string; label: string; buildId: string };

/**
 * eas mischt trotz --json Hinweiszeilen ("No environment variables with
 * visibility ... found") in stdout; JSON.parse darauf wirft. Ab der ersten
 * Klammer schneiden ist robuster, als auf saubere Streams zu hoffen.
 */
function easJson<T>(args: string[]): T {
  const stdout = execFileSync('eas', args, {
    encoding: 'utf-8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  const start = stdout.search(/[[{]/);
  if (start === -1) throw new Error(`Kein JSON in der Ausgabe von "eas ${args[0]}".`);
  return JSON.parse(stdout.slice(start)) as T;
}

function resolveChannel(): string {
  const flagIndex = process.argv.indexOf('--channel');
  if (flagIndex !== -1) {
    const value = process.argv[flagIndex + 1];
    if (!value) throw new Error('--channel ohne Wert übergeben.');
    return value;
  }

  // "preupdate:testflight" -> "testflight"
  const fromLifecycle = (process.env.npm_lifecycle_event ?? '').split(':')[1];
  if (fromLifecycle) return fromLifecycle;

  throw new Error(
    'Kanal nicht bestimmbar. Über npm run update:<kanal> aufrufen oder --channel <kanal> übergeben.',
  );
}

/**
 * Ohne --status, weil auch laufende Builds interessieren: der letzte fertige
 * beantwortet "reicht ein OTA?", ein noch laufender "ist der Build schon
 * unterwegs?". build:list liefert absteigend nach Erstellzeit, der erste
 * Treffer ist also jeweils der neueste.
 */
function buildsOnChannel(platform: Platform, channel: string): Build[] {
  const builds = easJson<Build[]>([
    'build:list',
    '--platform',
    platform,
    '--limit',
    '50',
    '--json',
    '--non-interactive',
  ]);

  return builds.filter((build) => build.updateChannel?.name === channel);
}

/**
 * fingerprint:compare benennt die beiden Hashes nur fingerprint1/fingerprint2
 * und dokumentiert keine Reihenfolge. Da der Build-Hash aus build:list schon
 * bekannt ist, ist der lokale der jeweils andere — unabhängig davon, in welcher
 * Reihenfolge eas sie ausgibt.
 */
function localFingerprint(buildId: string, buildHash: string, environment: string): string {
  const result = easJson<{ fingerprint1: { hash: string }; fingerprint2: { hash: string } }>([
    'fingerprint:compare',
    '--build-id',
    buildId,
    '--environment',
    environment,
    '--json',
    '--non-interactive',
  ]);

  const hashes = [result.fingerprint1.hash, result.fingerprint2.hash];
  return hashes.find((hash) => hash !== buildHash) ?? buildHash;
}

function labelFor(platform: Platform, build: Build): string {
  return `${platform} (Build ${build.appBuildVersion ?? build.id})`;
}

/**
 * Als Referenz für fingerprint:compare dient der letzte fertige Build; gibt es
 * keinen, tut es auch ein noch laufender. Das Kommando berechnet den lokalen
 * Hash unabhängig davon, gegen welche Build-ID es vergleicht — die ID bestimmt
 * nur den *anderen* der beiden Hashes.
 *
 * Genau darauf kommt es beim ersten Build einer Plattform an: solange nichts
 * fertig ist, gäbe es sonst keine ID, gegen die sich vergleichen ließe — und
 * ohne lokalen Hash keine Chance zu erkennen, dass der laufende Build bereits
 * dieser Stand ist. Der erste Android-Push würde dann bei jedem weiteren Push
 * einen zweiten, dritten, vierten Build starten.
 */
function inspect(channel: string, environment: string): Result[] {
  return PLATFORMS.map((platform): Result => {
    const builds = buildsOnChannel(platform, channel);
    const finished = builds.find((build) => build.status === 'FINISHED' && build.fingerprint);
    const reference = finished ?? builds.find((build) => build.fingerprint);
    if (!reference?.fingerprint) return { platform, state: 'no-build' };

    const local = localFingerprint(reference.id, reference.fingerprint.hash, environment);

    if (finished?.fingerprint?.hash === local) {
      return { platform, state: 'match', hash: local, label: labelFor(platform, finished) };
    }

    // Der lokale Stand passt nicht zum letzten fertigen Build — aber vielleicht
    // baut genau dieser Stand bereits. Der Fingerprint des laufenden Builds
    // kommt aus build:list und braucht keinen zweiten Vergleichsaufruf.
    const pending = builds.find(
      (build) => PENDING_STATES.includes(build.status) && build.fingerprint?.hash === local,
    );
    if (pending) {
      return { platform, state: 'pending', hash: local, label: labelFor(platform, pending) };
    }

    // Builds auf dem Kanal, aber keiner davon fertig: für ein OTA gibt es kein
    // Binary, und der laufende baut etwas anderes. Also wie "noch nie gebaut".
    if (!finished?.fingerprint) return { platform, state: 'no-build' };

    return {
      platform,
      state: 'mismatch',
      buildHash: finished.fingerprint.hash,
      local,
      label: labelFor(platform, finished),
      buildId: finished.id,
    };
  });
}

function report(results: Result[], channel: string) {
  for (const result of results) {
    if (result.state === 'no-build') {
      console.log(`· ${result.platform}: kein fertiger Build auf Kanal "${channel}", nichts zu vergleichen.`);
    } else if (result.state === 'match') {
      console.log(`✓ ${result.label}: runtimeVersion ${result.hash}`);
    } else if (result.state === 'pending') {
      console.log(`⏳ ${result.label}: baut bereits für runtimeVersion ${result.hash}`);
    } else {
      console.log(`✗ ${result.label}: Build erwartet ${result.buildHash}, lokal ${result.local}`);
    }
  }
}

function main() {
  const reportOnly = process.argv.includes('--report-only');
  const channel = resolveChannel();

  if (!reportOnly && process.env.SKIP_FINGERPRINT_CHECK) {
    console.log('· Fingerprint-Check übersprungen (SKIP_FINGERPRINT_CHECK gesetzt).');
    return;
  }

  const environment = CHANNEL_ENVIRONMENTS[channel];
  if (!environment) {
    throw new Error(
      `Kein Environment für Kanal "${channel}" hinterlegt. CHANNEL_ENVIRONMENTS in diesem Script ergänzen.`,
    );
  }

  const results = inspect(channel, environment);
  report(results, channel);

  const mismatches = results.filter((result) => result.state === 'mismatch');
  const matches = results.filter((result) => result.state === 'match');

  if (reportOnly) {
    // Ein OTA lohnt, sobald irgendein Binary auf dem Kanal die lokale
    // runtimeVersion anfragt. Plattformen ohne passenden Build blockieren das
    // nicht: `eas update` publiziert eine Update-Gruppe mit einer eigenen
    // runtimeVersion pro Plattform, und für die, die nicht passt, gibt es
    // stattdessen unten einen Build.
    const possible = matches.length > 0;

    // Ein neues Binary braucht, wessen Fingerprint abweicht ("mismatch") oder
    // wer auf dem Kanal noch gar keinen fertigen Build hat ("no-build").
    // "pending" fällt bewusst heraus — dieser Stand baut schon.
    const needsBuild = results
      .filter((result) => result.state === 'mismatch' || result.state === 'no-build')
      .map((result) => result.platform);

    // Der Wert geht direkt als --platform an `eas build`, das "all" für beide
    // Plattformen kennt. Leer heißt: nichts zu bauen.
    const buildPlatform =
      needsBuild.length === PLATFORMS.length ? 'all' : (needsBuild[0] ?? '');

    const pending = results.some((result) => result.state === 'pending');

    console.log(`\n→ ota-possible=${possible}`);
    console.log(`→ build-platform=${buildPlatform || '(nichts)'}`);
    console.log(`→ build-pending=${pending}`);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `ota-possible=${possible}\nbuild-platform=${buildPlatform}\nbuild-pending=${pending}\n`,
      );
    }
    return;
  }

  if (mismatches.length === 0) return;

  console.error(
    [
      '',
      `Der lokale Fingerprint passt nicht zum letzten Build auf Kanal "${channel}".`,
      'Ein Update von hier aus bekäme eine runtimeVersion, die kein installiertes',
      'Binary anfragt — es würde still nie ausgeliefert.',
      '',
      'Meist fehlen nur Dependencies aus dem Lockfile:',
      '  npm ci',
      '',
      'Sonst zeigt das hier, welche Quelle abweicht:',
      ...mismatches.map(
        (result) =>
          `  eas fingerprint:compare --build-id ${(result as { buildId: string }).buildId} --environment ${environment}`,
      ),
      '',
      'Ist die Abweichung gewollt (bewusst für ein älteres Binary publishen):',
      `  SKIP_FINGERPRINT_CHECK=1 npm run update:${channel}`,
      '',
    ].join('\n'),
  );
  process.exit(1);
}

main();
