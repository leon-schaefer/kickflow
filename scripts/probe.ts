/**
 * API-Explorer gegen einen echten Kickbase-Account. Läuft NUR lokal, wird
 * nie deployed. Zweck: die Doku-Lücken schließen, bevor mappers.ts final
 * verdrahtet wird — insbesondere Statuscodes (`st`), Formationsstrings und
 * die Basierung von `lo` (0- oder 1-indexiert).
 *
 * Nutzung:
 *   1. .env.local.example nach .env.local kopieren, KICKBASE_EMAIL/-PASSWORD eintragen
 *   2. npm run probe
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

  console.log('→ Lineup Overview …');
  const overview = await getJson(`/v4/leagues/${leagueId}/lineup/overview`, token);
  await dump('lineup-overview', overview);

  console.log('→ Squad …');
  const squad = await getJson(`/v4/leagues/${leagueId}/squad`, token);
  await dump('squad', squad);

  console.log('→ Competition-Tabelle (Teamnamen) …');
  const competitionId = leagueList[0].cpi ?? '1';
  try {
    const table = await getJson(`/v4/competitions/${competitionId}/table`, token);
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

  console.log(`\nAlle Rohantworten liegen in ${OUTPUT_DIR}`);
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
