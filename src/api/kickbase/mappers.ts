/**
 * Reine Funktionen: Rohes Kickbase-JSON (kurze Kürzel) → lesbare Domain-DTOs.
 * Keine Netzwerk-, keine Framework-Abhängigkeit — voll unit-testbar.
 *
 * Mehrere Mappings hier sind Best-Effort, weil die inoffizielle Doku keine
 * vollständige Codeliste liefert (siehe Kommentare bei mapStatus/mapTrend).
 * scripts/probe.ts sammelt reale Werte, um sie zu verifizieren/verfeinern.
 */
import type {
  RawCompetitionMatchdays,
  RawCompetitionTeam,
  RawFixture,
  RawLeagueRanking,
  RawLeagueRankingEntry,
  RawLineupOverview,
  RawLineupPlayer,
  RawLoginResponse,
  RawMarketOffer,
  RawMarketPlayer,
  RawMarketResponse,
  RawMarketValueHistory,
  RawPerformanceResponse,
  RawPlayerDetail,
  RawSquadPlayer,
} from './schemas';
import type {
  AuthSession,
  LeagueRanking,
  LeagueRankingEntry,
  LeagueSummary,
  LineupData,
  MarketData,
  MarketOffer,
  MarketPlayer,
  MarketValueHistory,
  MatchdayPerformance,
  MatchdaySchedule,
  PlayerDetail,
  PlayerStatus,
  Position,
  ScheduledFixture,
  ScheduledMatchday,
  SeasonPerformance,
  SquadPlayer,
  Team,
} from './types';
import type { RawLeague } from './schemas';
import { pointsPerMillion } from '@/utils/valueScore';

const IMAGE_CDN_BASE = 'https://kickbase.b-cdn.net/';

export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${IMAGE_CDN_BASE}${path}`;
}

export function mapPosition(pos: number | undefined): Position {
  switch (pos) {
    case 1:
      return 'GK';
    case 2:
      return 'DEF';
    case 4:
      return 'FWD';
    case 3:
    default:
      // Unbekannter/fehlender Code: konservativer Fallback statt Absturz.
      return 'MID';
  }
}

/**
 * Die Doku behauptete 0=fit, 4=verletzt, 128=unbekannt — per scripts/probe.ts
 * gegen einen echten Kader verifiziert: real beobachtet wurden nur 0 und 2.
 * `st: 2` trat exakt bei dem einen Bankspieler auf, der als einziger seine
 * Position (Angriff) nicht besetzen konnte, obwohl die Formation dort einen
 * zweiten Slot vorsah — starkes Indiz für "nicht einsetzbar" (verletzt).
 * `4` bleibt als Fallback erhalten, falls die Doku für andere Ligen/Accounts
 * doch zutrifft; alles andere ist weiterhin unbestätigt und wird nicht geraten.
 */
export function mapStatus(st: number | undefined): PlayerStatus {
  if (st === undefined || st === 0) return 'fit';
  if (st === 2 || st === 4) return 'injured';
  return 'unknown';
}

/**
 * `stl` ist gegen echte Accounts bisher AUSSCHLIESSLICH als leeres Array
 * beobachtet worden (siehe scripts/.probe-output/{squad,player-detail}.json)
 * — die Item-Form (Klartext-String? Objekt mit eigenen Kürzeln?) ist komplett
 * unverifiziert. Statt zu raten und im Zweifel "[object Object]" anzuzeigen,
 * werden nur String-Einträge übernommen; alles andere wird still verworfen.
 */
function mapStatusDetails(stl: unknown[] | undefined): string[] {
  if (!stl) return [];
  return stl.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Nur `1` (steigend) ist dokumentiert. `2` wird als Gegenstück (fallend)
 * angenommen — unverifiziert, siehe scripts/probe.ts.
 */
export function mapMarketValueTrend(mvt: number | undefined): 'up' | 'down' | 'flat' {
  if (mvt === 1) return 'up';
  if (mvt === 2) return 'down';
  return 'flat';
}

/** "4-2-4" → [4, 2, 4]. Unparsebare Segmente werden verworfen. */
export function parseFormation(formation: string | undefined): number[] {
  if (!formation) return [];
  return formation
    .split('-')
    .map((part) => Number.parseInt(part, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** Login-Antwort ist doku-uneindeutig ("tkn" vs. "token") — beide abfangen. */
export function toAuthSession(raw: RawLoginResponse): AuthSession {
  const token = raw.tkn ?? raw.token;
  if (!token) {
    throw new Error('Kickbase-Login-Antwort enthielt keinen Token (weder "tkn" noch "token").');
  }
  const userId = raw.u?.id ?? raw.user?.id;
  const userName = raw.u?.name ?? raw.user?.name;
  return {
    token,
    refreshToken: raw.rtkn ?? raw.refreshToken ?? null,
    userId: userId !== undefined ? String(userId) : null,
    userName: userName ?? null,
  };
}

export function toLeagueSummary(raw: RawLeague): LeagueSummary {
  return {
    id: raw.i,
    name: raw.n,
    // `cpi` ist trotz Doku-Namens ("Cover photo identifier") tatsächlich die
    // Competition-ID (z.B. "1" = Bundesliga) — per scripts/probe.ts verifiziert,
    // liefert an /v4/competitions/{cpi}/table die echten Bundesliga-Teams.
    coverImageUrl: imageUrl(raw.lim ?? raw.cpim),
    budget: raw.b ?? 0,
    teamValue: raw.tv ?? 0,
    // Weder `un` (Aktivitäts-/Ungelesen-Zähler) noch `lpc` (Lineup-Spielerzahl,
    // fast immer 11 — nicht zu verwechseln mit dem gleichnamigen `lpc` auf
    // lineup/overview, siehe lineupPlayerCount in toLineupData unten) noch `pl`
    // (eigene Platzierung) sind die Manager-Zahl — alle drei wurden das schon
    // fälschlich mal. /leagues/selection liefert sie gar nicht; getLeagues() in
    // endpoints.ts holt sie separat per /settings/managers und setzt sie hier
    // nachträglich. null = Zusatzrequest fehlgeschlagen.
    memberCount: null,
    isAdmin: raw.adm ?? false,
    competitionId: raw.cpi ?? '1',
  };
}

/** Team einer Competition-Tabelle (`/v4/competitions/{id}/table`) — einzige Quelle für Mannschaftsnamen. */
export function toTeam(raw: RawCompetitionTeam): Team {
  return {
    id: raw.tid,
    name: raw.tn ?? '',
    logoUrl: imageUrl(raw.tim),
  };
}

/**
 * Merged einen Kaderspieler (Basisdaten, immer vorhanden) mit seinem
 * Aufstellungs-Eintrag (nur vorhanden, wenn er aktuell in der Startelf steht).
 */
export function toSquadPlayer(
  raw: RawSquadPlayer,
  lineupEntry: RawLineupPlayer | undefined,
): SquadPlayer {
  const inLineup = lineupEntry !== undefined;
  const marketValue = raw.mv ?? lineupEntry?.mv ?? 0;
  const totalPoints = raw.p ?? 0;
  const averagePoints = raw.ap ?? lineupEntry?.ap ?? 0;
  return {
    id: raw.i,
    name: raw.n ?? lineupEntry?.n ?? 'Unbekannt',
    position: mapPosition(raw.pos ?? lineupEntry?.pos),
    teamId: raw.tid ?? lineupEntry?.tid ?? '',

    marketValue,
    marketValueTrend: mapMarketValueTrend(raw.mvt),
    // `sdmvt` (Tages-Marktwertänderung) ist nicht offiziell dokumentiert,
    // nur als Beispielfeld erschienen — Vorzeichen/Einheit unverifiziert.
    marketValueChangeToday: raw.sdmvt ?? 0,

    totalPoints,
    averagePoints,
    valueScoreAvg: pointsPerMillion(averagePoints, marketValue),
    valueScoreTotal: pointsPerMillion(totalPoints, marketValue),

    status: mapStatus(raw.st ?? lineupEntry?.st),
    statusDetails: mapStatusDetails(raw.stl),

    imageUrl: imageUrl(raw.pim ?? lineupEntry?.pim),
    teamLogoUrl: null,

    inLineup,
    lineupSlot: lineupEntry?.lo ?? null,
    isCaptain: lineupEntry?.ictp ?? false,

    onMarket: raw.iotm ?? false,
    offerCount: raw.ofc ?? 0,

    nextMatch:
      lineupEntry?.t1 && lineupEntry?.t2
        ? {
            homeTeamId: lineupEntry.t1,
            awayTeamId: lineupEntry.t2,
            homeLogoUrl: imageUrl(lineupEntry.t1im) ?? '',
            awayLogoUrl: imageUrl(lineupEntry.t2im) ?? '',
          }
        : null,
  };
}

export function toMarketOffer(raw: RawMarketOffer): MarketOffer {
  return {
    userId: raw.u ?? null,
    userName: raw.unm ?? null,
    price: raw.uop ?? 0,
    userImageUrl: imageUrl(raw.uim),
  };
}

export function toMarketPlayer(raw: RawMarketPlayer): MarketPlayer {
  const marketValue = raw.mv ?? 0;
  const totalPoints = raw.p ?? 0;
  const averagePoints = raw.ap ?? 0;
  return {
    id: raw.i,
    name: raw.n ?? 'Unbekannt',
    position: mapPosition(raw.pos),
    teamId: raw.tid ?? '',

    marketValue,
    marketValueTrend: mapMarketValueTrend(raw.mvt),

    totalPoints,
    averagePoints,
    valueScoreAvg: pointsPerMillion(averagePoints, marketValue),
    valueScoreTotal: pointsPerMillion(totalPoints, marketValue),

    status: mapStatus(raw.st),
    imageUrl: imageUrl(raw.pim),

    price: raw.prc ?? marketValue,
    isBotListing: raw.u === undefined,
    sellerName: raw.u?.n ?? null,
    offerCount: raw.ofc ?? 0,
    listedAt: raw.dt ?? null,

    // `iposl` bewusst nicht gemappt: laut echter API-Antwort redundant zu
    // `uop` gesetzt/undefined, siehe scripts/.probe-output/market-after-offer.json.
    expiresInSeconds: raw.exs ?? null,
    ownOfferPrice: raw.uop ?? null,
    ownOfferId: raw.uoid ?? null,
    offers: (raw.ofs ?? []).map(toMarketOffer),
  };
}

function toLeagueRankingEntry(raw: RawLeagueRankingEntry): LeagueRankingEntry {
  return {
    userId: raw.i ?? '',
    userName: raw.n ?? 'Unbekannt',
    userImageUrl: imageUrl(raw.uim),
    isAdmin: raw.adm ?? false,
    hasLineupSet: raw.pa ?? false,
    seasonPoints: raw.sp ?? 0,
    seasonPlace: raw.spl ?? 0,
    matchdayPoints: raw.mdp ?? 0,
    matchdayPlace: raw.mdpl ?? 0,
    teamValue: raw.tv ?? 0,
    // Auf String normalisieren: die API liefert Zahlen (siehe rawLeagueRankingEntrySchema.lp),
    // die restliche App — bis hin zu `/players/{id}` — rechnet mit String-IDs.
    lineupPlayerIds: (raw.lp ?? []).map((id) => (id === null ? null : String(id))),
  };
}

/** `GET /v4/leagues/{id}/ranking` — die Liga-Tabelle, siehe getLeagueRanking() in endpoints.ts. */
export function toLeagueRanking(raw: RawLeagueRanking): LeagueRanking {
  return {
    seasonName: raw.sn ?? null,
    day: raw.day ?? null,
    entries: raw.us.map(toLeagueRankingEntry),
  };
}

export function toMarketData(raw: RawMarketResponse): MarketData {
  return {
    players: raw.it.map(toMarketPlayer),
    marketValueUpdateAt: raw.mvud ?? null,
  };
}

/** `mdln` ist ein Label ("1 Match Day", "Match Day 2"), keine Zahl — erste Zahl im String gewinnt. */
export function parseMatchdayLabel(value: string | number | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

/**
 * ACHTUNG: `overview.b` ist trotz des Namens NICHT das Budget. Per
 * scripts/.probe-output verifiziert: `overview.b` = `30.000.000 − teamValue`
 * (Beispiel: Teamwert 116.957.307 → `b: -86.957.307`), während das echte
 * Budget (dort 5.140.853) nur in `LeagueSummary.budget` (aus
 * `/v4/leagues/selection` → `b`) steckt. Deshalb wird `overview.b` hier
 * bewusst NICHT gemappt — siehe useCurrentLeague() für die richtige Quelle.
 */
export function toLineupData(overview: RawLineupOverview, squad: RawSquadPlayer[]): LineupData {
  const lineupByPlayerId = new Map(overview.lp.map((entry) => [entry.pi, entry]));
  const players = squad.map((player) => toSquadPlayer(player, lineupByPlayerId.get(player.i)));

  const formation = overview.t ?? '';
  const inLineupCount = players.filter((p) => p.inLineup).length;

  return {
    // "mdln" ist real ein Label wie "1 Match Day"/"Match Day 2", keine reine
    // Zahl (per scripts/probe.ts) — nur Fallback, siehe resolveMatchdayState.
    matchday: parseMatchdayLabel(overview.mdln),
    lineupDeadline: overview.lis ?? null,
    formation,
    formationRows: parseFormation(formation),
    teamValue: players.reduce((sum, p) => sum + p.marketValue, 0),
    lineupPlayerCount: overview.lpc ?? inLineupCount,
    confirmedCount: overview.clpc ?? 0,
    players,
  };
}

export function toMarketValueHistory(raw: RawMarketValueHistory): MarketValueHistory {
  return {
    points: raw.it.map((p) => ({ date: p.dt, value: p.mv })),
    lowest: raw.lmv ?? 0,
    highest: raw.hmv ?? 0,
  };
}

export function toPlayerDetail(raw: RawPlayerDetail, performance: RawPerformanceResponse): PlayerDetail {
  const firstName = raw.fn ?? '';
  const lastName = raw.ln ?? '';
  return {
    id: raw.i,
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(' ') || 'Unbekannt',
    shirtNumber: raw.shn ?? null,
    teamId: raw.tid ?? '',
    teamName: raw.tn ?? '',
    position: mapPosition(raw.pos),
    goals: raw.g ?? 0,
    assists: raw.a ?? 0,
    totalPoints: raw.tp ?? 0,
    averagePoints: raw.ap ?? 0,
    secondsPlayed: raw.sec ?? 0,
    marketValue: raw.mv ?? 0,
    marketValueTrend: mapMarketValueTrend(raw.mvt),
    yellowCards: raw.y ?? 0,
    redCards: raw.r ?? 0,
    status: mapStatus(raw.st),
    statusDetails: mapStatusDetails(raw.stl),
    imageUrl: imageUrl(raw.pim),
    teamLogoUrl: imageUrl(raw.tim),
    seasonMatchCount: raw.smdc ?? 0,
    marketValueHistory92: { points: [], lowest: 0, highest: 0 },
    marketValueHistory365: { points: [], lowest: 0, highest: 0 },
    performance: toSeasonPerformances(performance),
  };
}

export function toSeasonPerformances(raw: RawPerformanceResponse): SeasonPerformance[] {
  return raw.it.map((season) => ({
    title: season.ti ?? '',
    leagueName: season.n ?? '',
    matchdays: season.ph.map(toMatchdayPerformance),
  }));
}

function toMatchdayPerformance(
  raw: RawPerformanceResponse['it'][number]['ph'][number],
): MatchdayPerformance {
  return {
    matchday: raw.day ?? 0,
    matchDate: raw.md ?? null,
    homeTeamId: raw.t1 ?? '',
    awayTeamId: raw.t2 ?? '',
    homeGoals: raw.t1g ?? 0,
    awayGoals: raw.t2g ?? 0,
    homeLogoUrl: imageUrl(raw.t1im),
    awayLogoUrl: imageUrl(raw.t2im),
    playerTeamId: raw.pt ?? '',
    // Zukünftige Spieltage liefern kein Ergebnis (t1g/t2g fehlen komplett) —
    // daran unterscheiden wir bereits ausgetragene von noch ausstehenden.
    hasResult: raw.t1g !== undefined && raw.t2g !== undefined,
    points: raw.p ?? 0,
    seasonAveragePoints: raw.ap ?? 0,
    seasonTotalPoints: raw.tp ?? 0,
    // "90'" / "0'" laut echter Antwort, nicht die von der Doku behauptete Zahl.
    minutesPlayed: raw.mp ? Number.parseInt(raw.mp, 10) || 0 : 0,
    isCurrent: raw.cur ?? false,
  };
}

/**
 * Der Spielplan der gesamten Competition (`/v4/competitions/{id}/matchdays`) —
 * anders als `mdln`/`lis` auf `lineup/overview` liefert das echte Anstoßzeiten
 * je Spieltag, aus denen resolveMatchdayState() den aktuell offenen/laufenden
 * Spieltag ableitet. Spieltage ohne `day` werden verworfen.
 */
export function toMatchdaySchedule(raw: RawCompetitionMatchdays): MatchdaySchedule {
  return {
    currentDay: raw.day ?? null,
    matchdays: raw.it
      .filter((md): md is typeof md & { day: number } => md.day !== undefined)
      .map(toScheduledMatchday),
  };
}

function toScheduledMatchday(raw: RawCompetitionMatchdays['it'][number] & { day: number }): ScheduledMatchday {
  const kickoffs = raw.it.map((fixture) => fixture.dt).filter((dt): dt is string => !!dt);
  const firstKickoff = kickoffs.length > 0 ? kickoffs.reduce((a, b) => (a < b ? a : b)) : null;
  return {
    day: raw.day,
    firstKickoff,
    allPlayed: raw.it.length > 0 && raw.it.every((fixture) => fixture.t1g !== undefined && fixture.t2g !== undefined),
    fixtures: raw.it.map(toScheduledFixture),
  };
}

function toScheduledFixture(raw: RawFixture): ScheduledFixture {
  return {
    homeTeamId: raw.t1 ?? '',
    awayTeamId: raw.t2 ?? '',
    homeLogoUrl: imageUrl(raw.t1im),
    awayLogoUrl: imageUrl(raw.t2im),
    homeGoals: raw.t1g ?? null,
    awayGoals: raw.t2g ?? null,
    hasResult: raw.t1g !== undefined && raw.t2g !== undefined,
  };
}
