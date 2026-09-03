/**
 * Beantwortet die Frage "passt der lokale Code noch zum installierten Binary?"
 * — also: reicht ein OTA-Update, oder braucht es einen neuen Build?
 *
 * Zwei Aufrufmodi:
 *   - blockierend (Default): läuft über die npm-pre-Hooks vor `eas update` und
 *     bricht bei Abweichung ab.
 *   - `--report-only`: bricht nie ab, schreibt stattdessen
 *     `ota-possible=true|false` nach $GITHUB_OUTPUT. Damit entscheidet
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
 * Geprüft werden nur Plattformen, für die es einen fertigen Build auf dem Kanal
 * gibt; für Android existiert derzeit keiner. Gibt es auf dem Kanal überhaupt
 * kein Binary, ist ein OTA sinnlos: der report-only-Modus meldet dann
 * ota-possible=false, damit der Workflow einen ersten Build anstößt.
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
  appBuildVersion: string | null;
  updateChannel: { name: string } | null;
  fingerprint: { hash: string } | null;
};

type Result =
  | { platform: Platform; state: 'no-build' }
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

function latestBuildOnChannel(platform: Platform, channel: string): Build | null {
  const builds = easJson<Build[]>([
    'build:list',
    '--platform',
    platform,
    '--status',
    'finished',
    '--limit',
    '50',
    '--json',
    '--non-interactive',
  ]);

  // build:list liefert absteigend nach Erstellzeit, der erste Treffer ist der neueste.
  return builds.find((build) => build.updateChannel?.name === channel) ?? null;
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

function inspect(channel: string, environment: string): Result[] {
  return PLATFORMS.map((platform): Result => {
    const build = latestBuildOnChannel(platform, channel);
    if (!build?.fingerprint) return { platform, state: 'no-build' };

    const buildHash = build.fingerprint.hash;
    const local = localFingerprint(build.id, buildHash, environment);
    const label = `${platform} (Build ${build.appBuildVersion ?? build.id})`;

    return local === buildHash
      ? { platform, state: 'match', hash: local, label }
      : { platform, state: 'mismatch', buildHash, local, label, buildId: build.id };
  });
}

function report(results: Result[], channel: string) {
  for (const result of results) {
    if (result.state === 'no-build') {
      console.log(`· ${result.platform}: kein fertiger Build auf Kanal "${channel}", übersprungen.`);
    } else if (result.state === 'match') {
      console.log(`✓ ${result.label}: runtimeVersion ${result.hash}`);
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
    // Ein OTA lohnt nur, wenn jedes Binary auf dem Kanal die lokale
    // runtimeVersion anfragt — und wenn es überhaupt eines gibt.
    const possible = mismatches.length === 0 && matches.length > 0;
    console.log(`\n→ ota-possible=${possible}`);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `ota-possible=${possible}\n`);
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
