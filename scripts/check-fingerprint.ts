/**
 * Preflight vor jedem `eas update`: prüft, ob der lokal berechnete
 * runtimeVersion-Fingerprint zu dem des letzten Builds auf dem Zielkanal passt.
 *
 * Warum das nötig ist: `eas update` hasht den Fingerprint aus dem *lokalen*
 * Projektbaum, `eas build` dagegen aus dem, was der Build-Server nach `npm ci`
 * vorfindet. Weichen die auseinander, wird das Update mit einer runtimeVersion
 * veröffentlicht, die kein installiertes Binary anfragt — expo-updates liefert
 * dann einfach nichts aus. Kein Fehler, keine Warnung, das Update existiert nur
 * für ein Binary, das es nicht gibt.
 *
 * Genau das ist am 03.09.2026 passiert: expo-observe (plus die transitive
 * expo-app-metrics) standen in package.json und package-lock.json, waren aber
 * lokal nicht installiert. Ohne die beiden fehlten ihre Einträge im
 * iOS-Autolinking-Config, der Hash fiel auf den Stand *vor* dem Observe-Commit
 * zurück (8c1325a2 statt 1f3de806) und die Updates landeten auf der
 * runtimeVersion eines zwei Tage alten Builds. Ein vergessenes `npm install`
 * reicht also — deshalb der Check.
 *
 * Läuft automatisch über die npm-pre-Hooks (preupdate:preview,
 * preupdate:testflight, preupdate:production); der Kanal kommt aus
 * npm_lifecycle_event, `--channel <name>` überschreibt das.
 *
 * Bewusst für eine ältere runtimeVersion publishen (etwa einen Fix für ein noch
 * verbreitetes Binary nachschieben): SKIP_FINGERPRINT_CHECK=1 setzen.
 *
 * Geprüft werden nur Plattformen, für die es überhaupt einen fertigen Build auf
 * dem Kanal gibt — für Android existiert derzeit keiner, das ist kein Fehler.
 */
import { execFileSync } from 'node:child_process';

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

function main() {
  if (process.env.SKIP_FINGERPRINT_CHECK) {
    console.log('· Fingerprint-Check übersprungen (SKIP_FINGERPRINT_CHECK gesetzt).');
    return;
  }

  const channel = resolveChannel();
  const environment = CHANNEL_ENVIRONMENTS[channel];
  if (!environment) {
    throw new Error(
      `Kein Environment für Kanal "${channel}" hinterlegt. CHANNEL_ENVIRONMENTS in diesem Script ergänzen.`,
    );
  }

  const mismatches: string[] = [];

  for (const platform of PLATFORMS) {
    const build = latestBuildOnChannel(platform, channel);
    if (!build?.fingerprint) {
      console.log(`· ${platform}: kein fertiger Build auf Kanal "${channel}", übersprungen.`);
      continue;
    }

    const buildHash = build.fingerprint.hash;
    const local = localFingerprint(build.id, buildHash, environment);
    const label = `${platform} (Build ${build.appBuildVersion ?? build.id})`;

    if (local === buildHash) {
      console.log(`✓ ${label}: runtimeVersion ${local}`);
      continue;
    }

    console.error(`✗ ${label}: Build erwartet ${buildHash}, lokal ${local}`);
    mismatches.push(`eas fingerprint:compare --build-id ${build.id} --environment ${environment}`);
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
      ...mismatches.map((command) => `  ${command}`),
      '',
      'Ist die Abweichung gewollt (bewusst für ein älteres Binary publishen):',
      `  SKIP_FINGERPRINT_CHECK=1 npm run update:${channel}`,
      '',
    ].join('\n'),
  );
  process.exit(1);
}

main();
