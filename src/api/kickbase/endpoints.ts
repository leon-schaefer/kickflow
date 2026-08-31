/**
 * Zusammengesetzte Kickbase-Aufrufe: HTTP + Validierung + Mapping in einem.
 * Das hier ist die einzige Schicht, die die App tatsächlich importiert.
 */
import { kbFetch } from './client';
import {
  toAuthSession,
  toLeagueSummary,
  toLineupData,
  toMarketPlayer,
  toMarketValueHistory,
  toMatchdaySchedule,
  toPlayerDetail,
  toTeam,
} from './mappers';
import {
  rawCompetitionMatchdaysSchema,
  rawCompetitionTableSchema,
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
  LeagueSummary,
  LineupData,
  MarketPlayer,
  MatchdaySchedule,
  PlaceOfferInput,
  PlayerDetail,
  SaveLineupInput,
  Team,
} from './types';

export async function login(email: string, password: string): Promise<AuthSession> {
  const raw = await kbFetch('/v4/user/login', {
    method: 'POST',
    body: { em: email, pass: password, loy: false, rep: {} },
  });
  return toAuthSession(rawLoginResponseSchema.parse(raw));
}

export async function getLeagues(token: string): Promise<LeagueSummary[]> {
  const raw = await kbFetch('/v4/leagues/selection', { token });
  return rawLeaguesResponseSchema.parse(raw).it.map(toLeagueSummary);
}

/**
 * Der zentrale Trick: `lineup/overview` (Startelf + Formation) und `squad`
 * (kompletter Kader) werden parallel geholt und zu EINEM Objekt gemerged.
 * Aufstellungs- und Kader-Screen lesen dieselbe Query — nie inkonsistent.
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

export async function getMarket(token: string, leagueId: string): Promise<MarketPlayer[]> {
  const raw = await kbFetch(`/v4/leagues/${leagueId}/market`, { token });
  return rawMarketResponseSchema.parse(raw).it.map(toMarketPlayer);
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
