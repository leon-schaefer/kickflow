/**
 * API-Explorer gegen einen echten Kickbase-Account. Läuft NUR lokal, wird
 * nie deployed. Zweck: die Doku-Lücken schließen, bevor mappers.ts final
 * verdrahtet wird — insbesondere Statuscodes (`st`), Formationsstrings und
 * die Basierung von `lo` (0- oder 1-indexiert).
 *
 * Nutzung:
 *   1. .env.local.example nach .env.local kopieren, KICKBASE_EMAIL/-PASSWORD eintragen
 *   2. npm run probe
 *   3. npm run probe -- --players  (klärt die Quelle für den competition-weiten
 *      Spielerbestand und die Besitzer-Zuordnung, siehe probeCompetitionPlayers()
 *      und probeOwnerSources() unten)
 *
 * Schreibt Rohantworten nach scripts/.probe-output/ (git-ignored) und eine
 * Zusammenfassung der auffälligen Felder auf die Konsole.
 */
import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// dotenv/config lädt standardmäßig nur ".env" — wir wollen explizit ".env.local".
config({ path: path.join(__dirname, '..', '.env.local') });

const BASE_URL = 'https://api.kickbase.com';
const OUTPUT_DIR = path.join(__dirname, '.probe-output');
const SAVE_LINEUP = process.argv.includes('--save-lineup');
const PROBE_OFFERS = process.argv.includes('--offers');
const PROBE_PLAYERS = process.argv.includes('--players');

async function main() {
  const email = process.env.KICKBASE_EMAIL;
  const password = process.env.KICKBASE_PASSWORD;
  if (!email || !password) {
    console.error(
      'KICKBASE_EMAIL / KICKBASE_PASSWORD fehlen. .env.local aus .env.local.example anlegen und ausfüllen.',
    );
    process.exit(1);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log('→ Login …');
  const loginRes = await fetch(`${BASE_URL}/v4/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ em: email, pass: password, loy: false, rep: {} }),
  });
  const loginBody = await loginRes.json();
  await dump('login', loginBody);
  if (!loginRes.ok) {
    console.error(`Login fehlgeschlagen (${loginRes.status}):`, loginBody);
    process.exit(1);
  }
  const token = loginBody.tkn ?? loginBody.token;
  if (!token) {
    console.error('Kein Token in der Login-Antwort gefunden. Rohantwort s. dump/login.json');
    process.exit(1);
  }
  console.log(`✓ Login ok. Token-Felder in Antwort: ${Object.keys(loginBody).join(', ')}`);

  console.log('→ Ligen …');
  const leagues = await getJson('/v4/leagues/selection', token);
  await dump('leagues', leagues);
  const leagueList = leagues.it ?? [];
  console.log(`✓ ${leagueList.length} Liga(en) gefunden.`);
  if (leagueList.length === 0) {
    console.warn('Keine Liga gefunden — Rest des Probes wird übersprungen.');
    return;
  }
  const leagueId = leagueList[0].i;
  console.log(`  Verwende Liga "${leagueList[0].n}" (${leagueId}) für die restlichen Aufrufe.`);

  // --- Manager-Zahl-Kandidaten: über ALLE Ligen, nicht nur leagueList[0] ---
  // Hintergrund: `memberCount` zeigte zuletzt konstant 11 an, weil es aus `lpc` auf
  // /leagues/selection gelesen wurde — das ist dort aber die Lineup-Spielerzahl, nicht
  // die Manager-Zahl (siehe mappers.ts). Mit mindestens zwei unterschiedlich großen
  // Ligen lässt sich das richtige Feld eindeutig identifizieren statt zu raten.
  console.log('\n=== Manager-Zahl-Kandidaten ===');
  console.log('Top-Level-Felder der /leagues/selection-Antwort:', {
    anol: leagues.anol,
    anopl: leagues.anopl,
    anoprl: leagues.anoprl,
  });
  for (const l of leagueList) {
    const numericFields = Object.fromEntries(
      Object.entries(l).filter(([, v]) => typeof v === 'number'),
    );
    console.log(`\nLiga "${l.n}" (${l.i}) — numerische Felder aus /leagues/selection:`, numericFields);

    let overviewMgc: unknown = 'n/a';
    let overviewMidLen: unknown = 'n/a';
    let overviewUsLen: unknown = 'n/a';
    try {
      const overview = await getJson(`/v4/leagues/${l.i}/overview?includeManagersAndBattles=true`, token);
      await dump(`overview-${l.i}`, overview);
      overviewMgc = overview.mgc;
      overviewMidLen = Array.isArray(overview.mid) ? overview.mid.length : 'n/a';
      overviewUsLen = Array.isArray(overview.us) ? overview.us.length : 'n/a';
      // Kandidat für "max. Spieler pro Verein" (mpst) — nicht offiziell
      // dokumentiert, siehe rawLeagueOverviewSchema. Gegen die
      // Liga-Einstellungen in der offiziellen Kickbase-App abgleichen.
      console.log(`  Liga "${l.n}" (${l.i}) — overview.mpst (max/Verein?)=${overview.mpst}, overview.mppu (Kadergröße?)=${overview.mppu}`);
    } catch (err) {
      console.warn(`  /leagues/${l.i}/overview fehlgeschlagen:`, err);
    }

    let rankingUsLen: unknown = 'n/a';
    try {
      const ranking = await getJson(`/v4/leagues/${l.i}/ranking`, token);
      await dump(`ranking-${l.i}`, ranking);
      rankingUsLen = Array.isArray(ranking.us) ? ranking.us.length : 'n/a';
    } catch (err) {
      console.warn(`  /leagues/${l.i}/ranking fehlgeschlagen:`, err);
    }

    let settingsUsLen: unknown = 'n/a';
    try {
      const settingsManagers = await getJson(`/v4/leagues/${l.i}/settings/managers`, token);
      await dump(`settings-managers-${l.i}`, settingsManagers);
      settingsUsLen = Array.isArray(settingsManagers.us) ? settingsManagers.us.length : 'n/a';
    } catch (err) {
      console.warn(`  /leagues/${l.i}/settings/managers fehlgeschlagen:`, err);
    }

    console.log(
      `  ${l.n}: un=${l.un} lpc=${l.lpc} pl=${l.pl} | overview.mgc=${overviewMgc} ` +
        `overview.mid=${overviewMidLen} overview.us=${overviewUsLen} | ranking.us=${rankingUsLen} | ` +
        `settings.us=${settingsUsLen}`,
    );
  }

  console.log('→ Lineup Overview …');
  const overview = await getJson(`/v4/leagues/${leagueId}/lineup/overview`, token);
  await dump('lineup-overview', overview);

  console.log('→ Squad …');
  const squad = await getJson(`/v4/leagues/${leagueId}/squad`, token);
  await dump('squad', squad);

  console.log('→ Competition-Tabelle (Teamnamen) …');
  const competitionId = leagueList[0].cpi ?? '1';
  // Außerhalb des try, damit --players unten die Team-IDs weiterverwenden kann.
  let competitionTable: any = null;
  try {
    const table = await getJson(`/v4/competitions/${competitionId}/table`, token);
    competitionTable = table;
    await dump('competition-table', table);
    console.log(
      '  tid → tn:',
      (table.it ?? []).map((t: any) => `${t.tid}=${t.tn}`).join(', '),
    );
  } catch (err) {
    console.warn('  /competitions/{id}/table fehlgeschlagen, probiere Fallback:', err);
  }
  try {
    const predTeams = await getJson(`/v4/base/predictions/teams/${competitionId}`, token);
    await dump('competition-teams-predictions', predTeams);
    console.log(
      '  (Fallback) tid → tn:',
      (predTeams.tms ?? []).map((t: any) => `${t.tid}=${t.tn}`).join(', '),
    );
  } catch (err) {
    console.warn('  /base/predictions/teams/{id} fehlgeschlagen:', err);
  }

  console.log('→ Spielplan (Matchdays) …');
  let matchdays: any = null;
  try {
    matchdays = await getJson(`/v4/competitions/${competitionId}/matchdays`, token);
    await dump('matchdays', matchdays);
  } catch (err) {
    console.warn('  /competitions/{id}/matchdays fehlgeschlagen:', err);
  }

  // --- Analyse: Statuscodes, Formation, Slot-Indizierung ---
  const distinctStatus = new Set<number>();
  for (const p of squad.it ?? []) if (typeof p.st === 'number') distinctStatus.add(p.st);
  for (const p of overview.lp ?? []) if (typeof p.st === 'number') distinctStatus.add(p.st);

  console.log('\n=== Zusammenfassung ===');
  console.log('Formation (t):', overview.t);
  console.log('Distinct st-Codes im Kader/Lineup:', [...distinctStatus].sort((a, b) => a - b));
  console.log(
    'lo-Werte in lineup.lp (Slot-Index):',
    (overview.lp ?? []).map((p: any) => p.lo),
  );
  console.log('lpc (gemeldete Lineup-Spielerzahl):', overview.lpc, '— tatsächlich lp.length:', (overview.lp ?? []).length);

  // mdln/lis werden bisher nirgends ausgegeben — genau das hat den
  // "Spieltag 0 nach Spieltag 1"-Bug durchrutschen lassen. Zusätzlich der
  // aus dem Spielplan abgeleitete Zustand (Logik gespiegelt aus
  // src/utils/matchday.ts#resolveMatchdayState, hier bewusst dupliziert,
  // da probe.ts absichtlich ohne src/-Imports läuft).
  console.log('\n=== Spieltag-Analyse ===');
  console.log('mdln (Label, lineup/overview):', overview.mdln);
  console.log('lis (Deadline, lineup/overview):', overview.lis);
  if (matchdays) {
    console.log('day (Top-Level, competitions/matchdays):', matchdays.day);
    const now = Date.now();
    const summarized = (matchdays.it ?? [])
      .filter((md: any) => typeof md.day === 'number')
      .map((md: any) => {
        const kickoffs = (md.it ?? []).map((f: any) => f.dt).filter(Boolean).sort();
        const allPlayed =
          (md.it ?? []).length > 0 &&
          (md.it ?? []).every((f: any) => f.t1g !== undefined && f.t2g !== undefined);
        return { day: md.day, firstKickoff: kickoffs[0] ?? null, allPlayed };
      })
      .sort((a: any, b: any) => a.day - b.day);
    const open = summarized.find(
      (md: any) => md.firstKickoff && new Date(md.firstKickoff).getTime() > now,
    );
    const runningCandidates = summarized.filter(
      (md: any) => md.firstKickoff && new Date(md.firstKickoff).getTime() <= now && !md.allPlayed,
    );
    const running = runningCandidates[runningCandidates.length - 1];
    console.log(
      'Abgeleiteter Zustand: running =',
      running ? running.day : null,
      ', open =',
      open ? { day: open.day, deadline: open.firstKickoff } : null,
    );
    console.log('Erste 5 Spieltage:', summarized.slice(0, 5));

    // Klärt zwei offene Fragen zum Duell-Modus (hh*-Felder, siehe
    // schemas.ts/rawLeagueRankingEntrySchema): (1) liefert der unskalierte
    // /ranking-Aufruf mitten in der Saison den Gegner des AKTUELLEN
    // Spieltags, und (2) verschiebt `?dayNumber=` die Paarung überhaupt.
    const currentDay = running ? running.day : (open ? open.day : null);
    if (currentDay !== null) {
      console.log(`\n=== Duell-Vergleich (hh*) ohne vs. mit ?dayNumber=${currentDay} ===`);
      try {
        const rankingUnscoped = await getJson(`/v4/leagues/${leagueId}/ranking`, token);
        const rankingScoped = await getJson(`/v4/leagues/${leagueId}/ranking?dayNumber=${currentDay}`, token);
        await dump(`ranking-dayNumber-${currentDay}-${leagueId}`, rankingScoped);
        const summarizeHh = (us: any[]) =>
          (us ?? []).map((u: any) => ({ n: u.n, hhoui: u.hhoui, hhpl: u.hhpl, hhsp: u.hhsp, hhmp: u.hhmp }));
        console.log('  ohne dayNumber:', summarizeHh(rankingUnscoped.us));
        console.log(`  mit dayNumber=${currentDay}:`, summarizeHh(rankingScoped.us));
      } catch (err) {
        console.warn('  Duell-Vergleich fehlgeschlagen:', err);
      }
    }
  } else {
    console.log('Kein Spielplan verfügbar — mdln/lis bleiben die einzige Quelle.');
  }

  if (SAVE_LINEUP) {
    console.log('\n=== --save-lineup: Speichern verifizieren ===');
    const lpSorted = [...(overview.lp ?? [])].sort((a: any, b: any) => (a.lo ?? 0) - (b.lo ?? 0));
    const playerIds = lpSorted.map((p: any) => p.pi);
    const formationType = overview.t;
    console.log(
      `Poste unveränderte Aufstellung zurück (${playerIds.length} Spieler, Formation ${formationType}) …`,
    );

    const primaryOk = await tryPostLineup(
      `/v4/leagues/${leagueId}/lineup`,
      { type: formationType, players: playerIds },
      'POST /lineup {type, players}',
      token,
    );
    if (!primaryOk) {
      await tryPostLineup(
        `/v4/leagues/${leagueId}/lineup/fill`,
        { lud: formationType, pls: playerIds },
        'POST /lineup/fill {lud, pls}',
        token,
      );
    }

    const overviewAfter = await getJson(`/v4/leagues/${leagueId}/lineup/overview`, token);
    await dump('lineup-overview-after-save', overviewAfter);
    console.log('Formation vorher/nachher:', overview.t, '→', overviewAfter.t);
    console.log(
      'lo-Reihenfolge vorher/nachher gleich?',
      JSON.stringify((overview.lp ?? []).map((p: any) => p.lo)) ===
        JSON.stringify((overviewAfter.lp ?? []).map((p: any) => p.lo)),
    );
  }

  if (squad.it?.[0]) {
    console.log('→ Spieler-Detail (erster Kaderspieler) …');
    const playerId = squad.it[0].i;
    const detail = await getJson(`/v4/leagues/${leagueId}/players/${playerId}`, token);
    await dump('player-detail', detail);
    const marketValue = await getJson(`/v4/leagues/${leagueId}/players/${playerId}/marketValue/92`, token);
    await dump('player-marketvalue', marketValue);
    const performance = await getJson(`/v4/leagues/${leagueId}/players/${playerId}/performance`, token);
    await dump('player-performance', performance);
  }

  console.log('→ Transfermarkt …');
  const market = await getJson(`/v4/leagues/${leagueId}/market`, token);
  await dump('market', market);
  console.log('Transfermarkt-Top-Level-Keys:', Object.keys(market));
  const marketItems = market.it ?? market.items ?? [];
  console.log(`  ${marketItems.length} Spieler auf dem Markt. Erster Eintrag:`, marketItems[0]);

  if (PROBE_OFFERS) {
    await probeOffers(token, leagueId, marketItems);
  }

  if (PROBE_PLAYERS) {
    await probeCompetitionPlayers(token, competitionId, competitionTable, squad.it?.[0]?.n);
    await probeOwnerSources(token, leagueId, marketItems);
  }

  console.log(`\nAlle Rohantworten liegen in ${OUTPUT_DIR}`);
}

/**
 * `--players`: klärt, über welchen Pfad der KOMPLETTE Spielerbestand einer
 * Competition (also alle Bundesliga-Spieler, nicht nur eigene und gelistete)
 * erreichbar ist. Alle Kandidaten hier sind UNVERIFIZIERT — die inoffiziellen
 * Doku-Quellen (kevinskyba/kickbase-api-doc, simonsagstetter/kickbase-api-v4-docs)
 * führen sie teils nur in v3-Pfadform. Der Probe probiert sie deshalb
 * nacheinander durch und dumpt jede Antwort, statt eine davon zu unterstellen.
 *
 * Für die Team-Kader reicht EIN Verein zur Identifikation des Pfads — der
 * Spieler-Tab läuft danach über alle 18 (siehe getCompetitionPlayers in
 * src/api/kickbase/endpoints.ts).
 */
async function probeCompetitionPlayers(
  token: string,
  competitionId: string,
  table: any,
  squadPlayerName: string | undefined,
) {
  console.log('\n=== --players: Quellen für den competition-weiten Spielerbestand ===');

  const teamIds: string[] = (table?.it ?? []).map((t: any) => t.tid).filter(Boolean);
  const sampleTeamId = teamIds[0];
  if (!sampleTeamId) {
    console.warn(
      '  Keine Team-IDs aus /competitions/{id}/table — die Team-Kader-Kandidaten werden übersprungen.',
    );
  }

  // Suchbegriff aus dem eigenen Kader: ein real existierender Nachname trifft
  // mit höherer Wahrscheinlichkeit als ein geratener, und ein leeres Ergebnis
  // wäre von "Endpoint liefert nie etwas" nicht zu unterscheiden.
  const searchTerm = (squadPlayerName ?? 'mueller').trim().split(/\s+/).pop() ?? 'mueller';
  console.log(`  Suchbegriff für die Such-Kandidaten: "${searchTerm}"`);

  const candidates: { label: string; path: string }[] = [
    ...(sampleTeamId
      ? [
          {
            label: 'Team-Kader (teamprofile)',
            path: `/v4/competitions/${competitionId}/teams/${sampleTeamId}/teamprofile`,
          },
          {
            label: 'Team-Kader (players)',
            path: `/v4/competitions/${competitionId}/teams/${sampleTeamId}/players`,
          },
          {
            label: 'Team-Kader (teamcenter)',
            path: `/v4/competitions/${competitionId}/teams/${sampleTeamId}/teamcenter`,
          },
        ]
      : []),
    {
      label: 'Suche (competition-scoped)',
      path: `/v4/competitions/${competitionId}/search?t=${encodeURIComponent(searchTerm)}`,
    },
    { label: 'Suche (global)', path: `/v4/competitions/search?t=${encodeURIComponent(searchTerm)}` },
    { label: 'Top-Spieler (best)', path: `/v4/competitions/${competitionId}/best?position=0` },
    { label: 'Spielerliste (players)', path: `/v4/competitions/${competitionId}/players` },
  ];

  const working: string[] = [];
  for (const candidate of candidates) {
    try {
      const body = await getJson(candidate.path, token);
      await dump(`competition-players-${dumpName(candidate.path)}`, body);
      const list = firstPlayerArray(body);
      console.log(`✓ ${candidate.label}  ${candidate.path}`);
      // Namen UND Typen: ein `pl: number` (statt der erhofften Spielerliste)
      // ist genau die Information, an der der erste Anlauf gescheitert ist.
      console.log(`    Felder: ${describeShape(body)}`);
      if (list) {
        working.push(candidate.path);
        console.log(`    ${list.items.length} Spieler unter "${list.key}". Erster Eintrag:`, list.items[0]);
      } else {
        console.log('    Kein Spieler-Array im Body erkannt (siehe Dump).');
      }
    } catch (err) {
      console.warn(`✗ ${candidate.label}  ${candidate.path}`);
      console.warn(`    ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('\nErgebnis:');
  if (working.length === 0) {
    console.log('  KEIN Kandidat liefert Spieler. Der Spieler-Tab bleibt ohne competition-weite Quelle.');
  } else {
    console.log(`  Nutzbar: ${working.join(', ')}`);
    console.log(
      '  Den obersten davon in TEAM_PLAYER_PATHS (src/api/kickbase/endpoints.ts) als einzigen\n' +
        '  Pfad stehen lassen und die übrigen Kandidaten dort löschen. Weichen die Feldnamen im\n' +
        '  Dump von rawCompetitionPlayerSchema (src/api/kickbase/schemas.ts) ab, dort nachziehen.',
    );
  }
}

/**
 * Zweiter Teil von `--players`: die Quellen für "wem gehört dieser Spieler".
 *
 * Die App leitet den Besitzer derzeit aus dem eigenen Kader, den
 * Transfermarkt-Listings und den Startelfen der Rangliste ab (siehe
 * resolvePlayerOwner in src/utils/playerOwnership.ts). Damit bleibt ein
 * Bankspieler eines Rivalen "unbekannt". Zwei Dinge würden das schließen, und
 * beide sind unverifiziert — deshalb hier nur nachgesehen, nicht geraten:
 *
 * 1. Ein Besitzerfeld in der liga-bezogenen Spielerantwort. Dafür wird ein
 *    FREMDER Spieler abgefragt (einer vom Transfermarkt), nicht ein eigener:
 *    bei eigenen Spielern wäre ein Besitzerfeld nicht von einem beliebigen
 *    "gehört dir"-Flag zu unterscheiden.
 * 2. Ein Endpoint für den kompletten Kader eines fremden Managers.
 */
async function probeOwnerSources(token: string, leagueId: string, marketItems: any[]) {
  console.log('\n=== --players: Besitzer-Quellen ===');

  const foreignPlayerId = marketItems.find((item: any) => item.i)?.i;
  if (!foreignPlayerId) {
    console.warn('  Kein Marktspieler vorhanden — der Test auf ein Besitzerfeld wird übersprungen.');
  } else {
    const path = `/v4/leagues/${leagueId}/players/${foreignPlayerId}`;
    try {
      const body = await getJson(path, token);
      await dump('player-detail-foreign', body);
      console.log(`✓ ${path}`);
      console.log(`    Felder: ${describeShape(body)}`);
      // Kandidaten fürs Auge: alles, was nach User-Referenz aussehen könnte.
      const suspects = Object.entries(body).filter(([key]) => /^(u|us|usr|user|own|ow)/i.test(key));
      console.log(
        suspects.length > 0
          ? `    Besitzer-Kandidaten: ${suspects.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}`
          : '    Kein Feld, dessen Name nach Besitzer/User aussieht — Dump trotzdem prüfen.',
      );
    } catch (err) {
      console.warn(`✗ ${path}`);
      console.warn(`    ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let managerId: string | undefined;
  try {
    const managers = await getJson(`/v4/leagues/${leagueId}/settings/managers`, token);
    managerId = (managers.us ?? []).map((u: any) => u.i).filter(Boolean)[0];
  } catch (err) {
    console.warn('  Manager-Liste nicht abrufbar:', err instanceof Error ? err.message : String(err));
  }

  if (!managerId) {
    console.warn('  Keine Manager-ID — die Kader-Endpoints werden übersprungen.');
    return;
  }

  const candidates = [
    `/v4/leagues/${leagueId}/managers/${managerId}/squad`,
    `/v4/leagues/${leagueId}/managers/${managerId}/players`,
    `/v4/leagues/${leagueId}/users/${managerId}/squad`,
    `/v4/leagues/${leagueId}/users/${managerId}/players`,
  ];
  for (const path of candidates) {
    try {
      const body = await getJson(path, token);
      await dump(`manager-squad-${dumpName(path)}`, body);
      const list = firstPlayerArray(body);
      console.log(`✓ ${path}`);
      console.log(`    Felder: ${describeShape(body)}`);
      console.log(
        list
          ? `    ${list.items.length} Spieler unter "${list.key}" — damit wäre der Besitz vollständig auflösbar.`
          : '    Kein Spieler-Array erkannt (siehe Dump).',
      );
    } catch (err) {
      console.warn(`✗ ${path}`);
      console.warn(`    ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/** Sucht im Body das erste Array, dessen Einträge nach Spielern aussehen (`i` plus `pos`/`mv`). */
function firstPlayerArray(body: any): { key: string; items: any[] } | null {
  for (const [key, value] of Object.entries(body ?? {})) {
    if (!Array.isArray(value) || value.length === 0) continue;
    const first: any = value[0];
    if (first && typeof first === 'object' && 'i' in first && ('pos' in first || 'mv' in first)) {
      return { key, items: value };
    }
  }
  return null;
}

/** `{tid: string, pl: number, it: array[24]}` — Feldnamen samt Typ einer Antwort. */
function describeShape(raw: any): string {
  if (typeof raw !== 'object' || raw === null) return typeof raw;
  const fields = Object.entries(raw).map(
    ([key, value]) => `${key}: ${Array.isArray(value) ? `array[${value.length}]` : typeof value}`,
  );
  return fields.length > 0 ? fields.join(', ') : '(leer)';
}

/** Pfad → dateisystemtauglicher Dump-Name. */
function dumpName(urlPath: string): string {
  return urlPath.replace(/^\/v4\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/, '');
}

async function getJson(path: string, token: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function dump(name: string, data: unknown) {
  await writeFile(path.join(OUTPUT_DIR, `${name}.json`), JSON.stringify(data, null, 2), 'utf-8');
}

/** Nur für --save-lineup: postet einen Aufstellungs-Body und loggt Status + Antwort. */
async function tryPostLineup(
  urlPath: string,
  body: unknown,
  label: string,
  token: string,
): Promise<boolean> {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const responseBody = await res.json().catch(() => null);
  console.log(`  ${label} → ${res.status}`, responseBody ?? '');
  return res.ok;
}

/**
 * Generischer Request für --offers: loggt IMMER Status + Body (auch bei
 * 4xx/5xx), wirft nie — anders als getJson/tryPostLineup, weil hier bewusst
 * mehrere unbelegte Pfad-/Body-Varianten durchprobiert werden.
 */
async function tryRequest(
  method: 'GET' | 'POST' | 'DELETE',
  urlPath: string,
  token: string,
  body?: unknown,
  label?: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const responseBody = await res.text().then((t) => (t.length ? safeJsonParse(t) : null));
  console.log(`  ${label ?? `${method} ${urlPath}`} → ${res.status}`, responseBody ?? '');
  return { ok: res.ok, status: res.status, body: responseBody };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * NUR mit --offers: gibt ein echtes Gebot in der echten Liga ab und zieht es
 * wieder zurück. Zweck: Pfad, Body-Feldnamen und Offer-ID-Quelle für
 * placeOffer/removeOffer (src/api/kickbase/endpoints.ts) verifizieren, bevor
 * dort Code dagegen verdrahtet wird — siehe Kommentar über saveLineup für
 * dasselbe Vorgehen bei der Aufstellung.
 *
 * Zielspieler: billigstes Kickbase-Listing (kein Verkäufer `u`) OHNE eigenes
 * Gebot (`iposl` nicht true) — damit ist der Schaden im schlimmsten Fall
 * minimal, und der Vorher/Nachher-Vergleich ist eindeutig.
 */
async function probeOffers(token: string, leagueId: string, marketItems: any[]): Promise<void> {
  console.log('\n=== --offers: Gebot abgeben/zurückziehen verifizieren ===');

  const candidates = marketItems.filter((p) => !p.u && p.iposl !== true && typeof p.prc === 'number');
  if (candidates.length === 0) {
    console.warn('Kein passendes Kickbase-Listing ohne eigenes Gebot gefunden — --offers übersprungen.');
    return;
  }
  const target = candidates.sort((a, b) => a.prc - b.prc)[0];
  console.log(`Zielspieler: ${target.fn ?? ''} ${target.n} (${target.i}), Angebotspreis ${target.prc}`);

  console.log('\n-- 1. Lesend prüfen, ob es einen eigenen Offers-Endpoint gibt --');
  await tryRequest('GET', `/v4/leagues/${leagueId}/market/${target.i}/offers`, token, undefined, 'GET .../offers (Spieler)');
  await tryRequest('GET', `/v4/leagues/${leagueId}/market/offers`, token, undefined, 'GET .../market/offers (Liga)');

  console.log('\n-- 2. Gebot abgeben --');
  const placed = await tryRequest(
    'POST',
    `/v4/leagues/${leagueId}/market/${target.i}/offers`,
    token,
    { price: target.prc },
    'POST .../offers {price}',
  );
  if (!placed.ok) {
    console.error('Gebots-POST nicht erfolgreich — --offers bricht ab, es wurde nichts geboten.');
    return;
  }
  // Verifiziert am 31.08.2026: Antwort ist { ofi: "<eigene User-ID>" } — die
  // "Offer-ID" ist schlicht die eigene User-ID (ein Gebot pro Nutzer/Spieler).
  const offerId = (placed.body as any)?.ofi;

  const afterOffer = await getJson(`/v4/leagues/${leagueId}/market`, token);
  await dump('market-after-offer', afterOffer);
  const afterItem = (afterOffer.it ?? []).find((p: any) => p.i === target.i);
  console.log('Zielspieler nach dem Gebot (ofc/uop/uoid/iposl/ofs):', {
    ofc: afterItem?.ofc,
    uop: afterItem?.uop,
    uoid: afterItem?.uoid,
    iposl: afterItem?.iposl,
    ofs: afterItem?.ofs,
  });

  console.log('\n-- 2b. Gebot per erneutem POST ändern (Upsert-Verhalten prüfen) --');
  const higherPrice = target.prc + 1;
  await tryRequest(
    'POST',
    `/v4/leagues/${leagueId}/market/${target.i}/offers`,
    token,
    { price: higherPrice },
    'POST .../offers {price: higher} (soll überschreiben, nicht duplizieren)',
  );
  const afterChange = await getJson(`/v4/leagues/${leagueId}/market`, token);
  const afterChangeItem = (afterChange.it ?? []).find((p: any) => p.i === target.i);
  console.log('Zielspieler nach geändertem Gebot (ofc sollte weiterhin 1 sein, uop = neuer Preis):', {
    ofc: afterChangeItem?.ofc,
    uop: afterChangeItem?.uop,
    ofs: afterChangeItem?.ofs,
  });

  console.log('\n-- 3. Gebot zurückziehen --');
  let removed = { ok: false, status: 0, body: null as unknown };
  if (offerId) {
    removed = await tryRequest(
      'DELETE',
      `/v4/leagues/${leagueId}/market/${target.i}/offers/${offerId}`,
      token,
      undefined,
      'DELETE .../offers/{offerId}',
    );
  }
  if (!removed.ok) {
    removed = await tryRequest(
      'DELETE',
      `/v4/leagues/${leagueId}/market/${target.i}/offers`,
      token,
      undefined,
      'DELETE .../offers (ohne ID)',
    );
  }

  const afterRemove = await getJson(`/v4/leagues/${leagueId}/market`, token);
  await dump('market-after-remove-offer', afterRemove);
  const afterRemoveItem = (afterRemove.it ?? []).find((p: any) => p.i === target.i);
  console.log('Zielspieler nach dem Zurückziehen (ofc/uop/uoid/iposl/ofs):', {
    ofc: afterRemoveItem?.ofc,
    uop: afterRemoveItem?.uop,
    uoid: afterRemoveItem?.uoid,
    iposl: afterRemoveItem?.iposl,
    ofs: afterRemoveItem?.ofs,
  });

  const cleanedUp = !afterRemoveItem?.uop && afterRemoveItem?.iposl !== true;
  if (cleanedUp) {
    console.log('✓ Gebot erfolgreich zurückgezogen — Ausgangszustand wiederhergestellt.');
  } else {
    console.error(
      `✗ ACHTUNG: Das Gebot auf ${target.fn ?? ''} ${target.n} scheint noch offen zu sein! ` +
        'Bitte manuell in der Kickbase-App zurückziehen.',
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
