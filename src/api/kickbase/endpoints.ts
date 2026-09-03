/**
 * Zusammengesetzte Kickbase-Aufrufe: HTTP + Validierung + Mapping in einem.
 * Das hier ist die einzige Schicht, die die App tatsächlich importiert.
 */
import { kbFetch } from './client';
import { withCompetitionPlayersLimit, withPerformanceLimit, withPlayerLookupLimit } from './limiter';
import {
  toAuthSession,
  toCompetitionPlayers,
  toLeagueOverview,
  toLeagueRanking,
  toLeagueSummary,
  toLineupData,
  toMarketData,
  toMarketValueHistory,
  toMatchdaySchedule,
  toPlayerDetail,
  toSeasonPerformances,
  toTeam,
} from './mappers';
import {
  rawCompetitionMatchdaysSchema,
  rawCompetitionPlayersSchema,
  rawCompetitionTableSchema,
  rawLeagueManagersSchema,
  rawLeagueOverviewSchema,
  rawLeagueRankingSchema,
  rawLeaguesResponseSchema,
  rawLineupOverviewSchema,
  rawLoginResponseSchema,
  rawMarketResponseSchema,
  rawMarketValueHistorySchema,
  rawPerformanceResponseSchema,
  rawPlayerDetailSchema,
  rawSquadResponseSchema,
} from './schemas';
import type {
  AuthSession,
  CompetitionPlayer,
  LeagueOverview,
  LeagueRanking,
  LeagueSummary,
  LineupData,
  MarketData,
  MatchdaySchedule,
  PlaceOfferInput,
  PlayerDetail,
  SaveLineupInput,
  SeasonPerformance,
  Team,
} from './types';

export async function login(email: string, password: string): Promise<AuthSession> {
  const raw = await kbFetch('/v4/user/login', {
    method: 'POST',
    body: { em: email, pass: password, loy: false, rep: {} },
  });
  return toAuthSession(rawLoginResponseSchema.parse(raw));
}

/**
 * Manager-Zahl einer einzelnen Liga. `/leagues/selection` (getLeagues) liefert
 * dafür KEIN brauchbares Feld — `un`, `lpc` und `pl` wurden alle schon fälschlich
 * dafür gehalten (siehe toLeagueSummary in mappers.ts). Verifiziert am 01.09.2026
 * per `npm run probe` gegen zwei real unterschiedlich große Ligen: `us.length` auf
 * `/settings/managers` ergab 12 bzw. 2 — deckungsgleich mit `overview.mgc` und
 * `ranking.us.length`, aber mit dem schlankesten Payload der drei.
 * `null` statt eines Requestfehlers, damit ein einzelner ausgefallener
 * Zusatzrequest nie die ganze Ligenliste zum Absturz bringt (siehe getLeagues).
 */
export async function getLeagueManagerCount(token: string, leagueId: string): Promise<number | null> {
  const raw = await kbFetch(`/v4/leagues/${leagueId}/settings/managers`, { token });
  return rawLeagueManagersSchema.parse(raw).us.length;
}

export async function getLeagues(token: string): Promise<LeagueSummary[]> {
  const raw = await kbFetch('/v4/leagues/selection', { token });
  const leagues = rawLeaguesResponseSchema.parse(raw).it.map(toLeagueSummary);

  // Pro Liga parallel nachladen statt seriell — und mit allSettled, damit eine
  // einzelne fehlgeschlagene Liga (z.B. Rechte fehlen) nicht die ganze Liste kippt.
  const counts = await Promise.allSettled(
    leagues.map((league) => getLeagueManagerCount(token, league.id)),
  );
  leagues.forEach((league, index) => {
    const result = counts[index];
    league.memberCount = result?.status === 'fulfilled' ? result.value : null;
  });

  return leagues;
}

/**
 * Der zentrale Trick: `lineup/overview` (Startelf + Formation) und `squad`
 * (kompletter Kader) werden parallel geholt und zu EINEM Objekt gemerged.
 * Der Aufstellungs-Screen und der Kader-Filter des Spieler-Tabs lesen
 * dieselbe Query — nie inkonsistent, und keiner von beiden kostet den anderen
 * einen Request.
 */
export async function getLineup(token: string, leagueId: string): Promise<LineupData> {
  const [overviewRaw, squadRaw] = await Promise.all([
    kbFetch(`/v4/leagues/${leagueId}/lineup/overview`, { token }),
    kbFetch(`/v4/leagues/${leagueId}/squad`, { token }),
  ]);
  const overview = rawLineupOverviewSchema.parse(overviewRaw);
  const squad = rawSquadResponseSchema.parse(squadRaw);
  return toLineupData(overview, squad.it);
}

/**
 * Liga-Tabelle mit Platzierung, Punkten, Teamwert und — je Manager — den
 * Spieler-IDs seiner Startelf (`lp[]`, nur Startelf, nicht der ganze Kader).
 * Der Pfad selbst ist in `scripts/probe.ts` gegen einen echten Account
 * verifiziert; die einzelnen Feldnamen stammen aus den inoffiziellen
 * v4-Spezifikationen samt echter Beispielantwort (siehe schemas.ts) — daher
 * das durchgehend defensive Mapping in toLeagueRanking(). `dayNumber` liefert
 * den Stand GENAU dieses Spieltags — inklusive der an ihm aufgestellten `lp[]`.
 * Ohne Angabe antwortet Kickbase mit der Saisonwertung, deren `lp[]` der Stand
 * des zuletzt abgerechneten Spieltags ist (und eben NICHT die aktuelle Elf).
 */
export async function getLeagueRanking(
  token: string,
  leagueId: string,
  dayNumber?: number,
): Promise<LeagueRanking> {
  const query = dayNumber !== undefined ? `?dayNumber=${dayNumber}` : '';
  const raw = await kbFetch(`/v4/leagues/${leagueId}/ranking${query}`, { token });
  return toLeagueRanking(rawLeagueRankingSchema.parse(raw));
}

/**
 * Liga-Einstellungen aus `/v4/leagues/{id}/overview` — ohne
 * `includeManagersAndBattles=true` (siehe scripts/probe.ts), weil weder
 * Manager-Liste noch Liga-Awards gebraucht werden. `mpst`/`mppu` sind nicht
 * offiziell dokumentiert (siehe rawLeagueOverviewSchema), deshalb nur als
 * Vorbelegung für die lokale Regel genutzt — siehe useLeagueRules.ts.
 */
export async function getLeagueOverview(token: string, leagueId: string): Promise<LeagueOverview> {
  const raw = await kbFetch(`/v4/leagues/${leagueId}/overview`, { token });
  return toLeagueOverview(rawLeagueOverviewSchema.parse(raw));
}

export async function getMarket(token: string, leagueId: string): Promise<MarketData> {
  const raw = await kbFetch(`/v4/leagues/${leagueId}/market`, { token });
  return toMarketData(rawMarketResponseSchema.parse(raw));
}

/**
 * Alle Teams einer Competition (z.B. Bundesliga) samt Namen und Logo — die
 * einzige verfügbare Quelle für Mannschaftsnamen, siehe mappers.ts/toTeam.
 */
export async function getCompetitionTeams(token: string, competitionId: string): Promise<Team[]> {
  const raw = await kbFetch(`/v4/competitions/${competitionId}/table`, { token });
  return rawCompetitionTableSchema.parse(raw).it.map(toTeam);
}

/**
 * Kandidatenpfade für den Kader EINES Vereins innerhalb einer Competition.
 *
 * Stand 03.09.2026 gegen einen echten Account: `teamprofile` und `teamcenter`
 * antworten beide mit 200, `/teams/{id}/players` mit 404 (deshalb nicht mehr
 * in der Liste). Welche der beiden 200er-Antworten den Kader trägt, ist noch
 * offen — die Pfadsuche unten entscheidet das am Inhalt, indem sie den ersten
 * Pfad nimmt, in dem pickCompetitionPlayers() eine Spielerliste findet.
 *
 * Nach `npm run probe -- --players` (siehe scripts/probe.ts) steht der Pfad
 * fest — dann hier den anderen Kandidaten löschen, damit im Normalbetrieb kein
 * vergeblicher Request mehr steht.
 */
type TeamPlayerPath = (competitionId: string, teamId: string) => string;

const TEAM_PLAYER_PATHS: TeamPlayerPath[] = [
  (competitionId, teamId) => `/v4/competitions/${competitionId}/teams/${teamId}/teamprofile`,
  (competitionId, teamId) => `/v4/competitions/${competitionId}/teams/${teamId}/teamcenter`,
];

/**
 * Der Pfad, der zuletzt Spieler geliefert hat — Modul-Zustand, damit die
 * Pfadsuche nicht bei jedem der 18 Vereine erneut läuft. Absichtlich NICHT
 * persistiert: der Prozess-Lebenszyklus ist die richtige Gültigkeitsdauer,
 * ein einmal falsch gemerkter Pfad wäre sonst über App-Neustarts hinweg fest.
 */
let resolvedTeamPlayerPath: TeamPlayerPath | null = null;

/**
 * `{tid: string, pl: number, it: array[24]}` — die Feldnamen samt Typ einer
 * Antwort, in der keine Spielerliste gefunden wurde. Steht so in der
 * Fehlermeldung: ein 200 ohne erkennbare Liste ist sonst nicht von einem
 * kaputten Pfad zu unterscheiden, und genau diese Information fehlte beim
 * ersten Anlauf (siehe rawCompetitionPlayersSchema).
 */
function describeShape(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null) return typeof raw;
  const fields = Object.entries(raw).map(
    ([key, value]) => `${key}: ${Array.isArray(value) ? `array[${value.length}]` : typeof value}`,
  );
  return fields.length > 0 ? fields.join(', ') : '(leer)';
}

async function fetchTeamPlayers(
  token: string,
  competitionId: string,
  teamId: string,
): Promise<CompetitionPlayer[]> {
  async function load(buildPath: TeamPlayerPath) {
    const raw = await withCompetitionPlayersLimit(() =>
      kbFetch(buildPath(competitionId, teamId), { token }),
    );
    return { raw, players: toCompetitionPlayers(rawCompetitionPlayersSchema.parse(raw), teamId) };
  }

  if (resolvedTeamPlayerPath) return (await load(resolvedTeamPlayerPath)).players;

  const failures: string[] = [];
  for (const buildPath of TEAM_PLAYER_PATHS) {
    const path = buildPath(competitionId, teamId);
    try {
      const { raw, players } = await load(buildPath);
      // 200 ohne erkennbare Spielerliste heißt: Pfad existiert, trägt aber
      // nicht die gesuchten Daten — nächster Kandidat, statt ihn für alle
      // weiteren Vereine festzuschreiben.
      if (players.length === 0) {
        failures.push(`${path} → 200, aber keine Spielerliste erkannt. Felder: ${describeShape(raw)}`);
        continue;
      }
      resolvedTeamPlayerPath = buildPath;
      return players;
    } catch (err) {
      failures.push(`${path} → ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(
    `Kein bekannter Pfad liefert den Vereinskader:\n${failures.join('\n')}\n` +
      'Pfad mit `npm run probe -- --players` bestimmen und in TEAM_PLAYER_PATHS eintragen.',
  );
}

/**
 * Der komplette Spielerbestand einer Competition — ein Request pro Verein,
 * gedrosselt über withCompetitionPlayersLimit. Grundlage des Spieler-Tabs,
 * der als Einziger auch Spieler zeigt, die weder im eigenen Kader noch auf dem
 * Transfermarkt stehen.
 *
 * Der erste Verein läuft SERIELL vorweg: solange `resolvedTeamPlayerPath` noch
 * leer ist, würden 18 parallele Aufrufe die Pfadsuche 18-fach durchlaufen und
 * im schlechtesten Fall 36 vergebliche Requests auslösen.
 *
 * `allSettled` für den Rest, aus demselben Grund wie in getLeagues(): ein
 * einzelner ausgefallener Verein soll die Liste nicht kippen. Der Aufrufer
 * bekommt dann eben 17 Vereine — vollständig genug für Suche und Sortierung,
 * und ein harter Fehler bliebe die schlechtere Antwort.
 */
export async function getCompetitionPlayers(
  token: string,
  competitionId: string,
  teamIds: readonly string[],
): Promise<CompetitionPlayer[]> {
  if (teamIds.length === 0) return [];

  const [firstTeamId, ...remainingTeamIds] = teamIds;
  const players = await fetchTeamPlayers(token, competitionId, firstTeamId);

  const rest = await Promise.allSettled(
    remainingTeamIds.map((teamId) => fetchTeamPlayers(token, competitionId, teamId)),
  );
  for (const result of rest) {
    if (result.status === 'fulfilled') players.push(...result.value);
  }

  // Ein Spieler kann in zwei Kadern auftauchen (Wechsel innerhalb der Liga,
  // je nachdem wie zeitnah Kickbase die Vereinszuordnung nachzieht) — doppelte
  // Zeilen in einer Suchliste wären ein sichtbarer Fehler.
  return [...new Map(players.map((player) => [player.id, player])).values()];
}

/**
 * Der Spielplan der Competition (z.B. Bundesliga) mit Anstoßzeiten je Spiel —
 * anders als `mdln`/`lis` auf `getLineup` die verlässliche Quelle dafür,
 * welcher Spieltag gerade läuft und wann der nächste Aufstellungsdeadline ist.
 */
export async function getMatchdays(token: string, competitionId: string): Promise<MatchdaySchedule> {
  const raw = await kbFetch(`/v4/competitions/${competitionId}/matchdays`, { token });
  return toMatchdaySchedule(rawCompetitionMatchdaysSchema.parse(raw));
}

export async function getPlayer(
  token: string,
  leagueId: string,
  playerId: string,
): Promise<PlayerDetail> {
  const [detailRaw, marketValue92Raw, marketValue365Raw, performanceRaw] = await Promise.all([
    kbFetch(`/v4/leagues/${leagueId}/players/${playerId}`, { token }),
    kbFetch(`/v4/leagues/${leagueId}/players/${playerId}/marketValue/92`, { token }),
    kbFetch(`/v4/leagues/${leagueId}/players/${playerId}/marketValue/365`, { token }),
    kbFetch(`/v4/leagues/${leagueId}/players/${playerId}/performance`, { token }),
  ]);
  const detail = rawPlayerDetailSchema.parse(detailRaw);
  const marketValue92 = rawMarketValueHistorySchema.parse(marketValue92Raw);
  const marketValue365 = rawMarketValueHistorySchema.parse(marketValue365Raw);
  const performance = rawPerformanceResponseSchema.parse(performanceRaw);

  const playerDetail = toPlayerDetail(detail, performance);
  playerDetail.marketValueHistory92 = toMarketValueHistory(marketValue92);
  playerDetail.marketValueHistory365 = toMarketValueHistory(marketValue365);
  return playerDetail;
}

/**
 * NUR die Basis-Spielerdaten (Name, Position, Marktwert, Foto, Status) — EIN
 * Request statt der vier von getPlayer(). Gebraucht für die Rivalen-Elf im
 * Liga-Tab (siehe manager/[managerId].tsx): dort müssen bis zu 11 fremde
 * Spieler-IDs auf einmal aufgelöst werden, ohne für jeden zusätzlich
 * Marktwertverlauf und Saison-Performance mitzuladen. `toPlayerDetail()`
 * verlangt eine Performance-Antwort für seine Signatur — hier bewusst leer,
 * `PlayerDetail.performance` bleibt entsprechend `[]`.
 */
export async function getPlayerBasic(token: string, leagueId: string, playerId: string): Promise<PlayerDetail> {
  const raw = await withPlayerLookupLimit(() => kbFetch(`/v4/leagues/${leagueId}/players/${playerId}`, { token }));
  return toPlayerDetail(rawPlayerDetailSchema.parse(raw), { it: [] });
}

/**
 * NUR die Saison-Performance eines Spielers — bewusst schmal, im Gegensatz zu
 * getPlayer(), das dafür vier Requests abfeuert. Kickbase liefert Spielminuten
 * ausschließlich hier (`ph[].mp`), nicht in Kader- oder Marktlisten; der
 * Spieler- und der Markt-Tab rufen das deshalb pro Spieler auf. Das Concurrency-Gate hält den
 * daraus entstehenden Schwung Requests von Cloudflare fern.
 */
export async function getPlayerPerformance(
  token: string,
  leagueId: string,
  playerId: string,
): Promise<SeasonPerformance[]> {
  const raw = await withPerformanceLimit(() =>
    kbFetch(`/v4/leagues/${leagueId}/players/${playerId}/performance`, { token }),
  );
  return toSeasonPerformances(rawPerformanceResponseSchema.parse(raw));
}

/**
 * `POST /lineup/fill` existiert laut Swagger (simonsagstetter/kickbase-api-v4-docs)
 * nur unter `/v4/challenges/{id}/` (parameterloses Autofill) — der Liga-Pfad
 * ist `POST /v4/leagues/{id}/lineup` mit {type, players}, `type` = der
 * Formationsstring wie in `overview.t` (z.B. "4-4-2"). Verifiziert am
 * 31.08.2026 per `npm run probe -- --save-lineup` gegen einen echten Account:
 * 200, Formation und lo-Reihenfolge unverändert.
 */
export async function saveLineup(
  token: string,
  leagueId: string,
  input: SaveLineupInput,
): Promise<void> {
  await kbFetch(`/v4/leagues/${leagueId}/lineup`, {
    token,
    method: 'POST',
    body: { type: input.formation, players: input.playerIds },
  });
}

/**
 * Gebot auf einen Transfermarkt-Spieler abgeben oder ändern. Verifiziert am
 * 31.08.2026 per `npm run probe -- --offers` gegen einen echten Account:
 * `POST /v4/leagues/{id}/market/{playerId}/offers` mit `{price}` → 200,
 * Antwort `{ ofi: "<eigene User-ID>" }`. Ein erneuter POST mit anderem Preis
 * überschreibt das bestehende Gebot (kein Duplikat, `ofc` bleibt 1) — dient
 * also auch zum Ändern eines Gebots.
 */
export async function placeOffer(
  token: string,
  leagueId: string,
  input: PlaceOfferInput,
): Promise<void> {
  await kbFetch(`/v4/leagues/${leagueId}/market/${input.playerId}/offers`, {
    token,
    method: 'POST',
    body: { price: input.price },
  });
}

/**
 * Eigenes Gebot zurückziehen. `offerId` ist laut Probe schlicht die eigene
 * User-ID (siehe `MarketPlayer.ownOfferId`, gemappt aus dem Rohfeld `uoid`)
 * — es gibt nur ein Gebot pro Nutzer und Spieler. Verifiziert am 31.08.2026
 * per `npm run probe -- --offers`: `DELETE .../offers/{offerId}` → 200 {}.
 */
export async function removeOffer(token: string, leagueId: string, playerId: string, offerId: string): Promise<void> {
  await kbFetch(`/v4/leagues/${leagueId}/market/${playerId}/offers/${offerId}`, {
    token,
    method: 'DELETE',
  });
}
