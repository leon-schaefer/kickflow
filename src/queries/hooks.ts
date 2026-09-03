import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  getCompetitionPlayers,
  getCompetitionTeams,
  getLeagueOverview,
  getLeagueRanking,
  getLeagues,
  getLineup,
  getMarket,
  getMatchdays,
  getPlayer,
  getPlayerBasic,
  getPlayerPerformance,
  placeOffer,
  removeOffer,
  saveLineup,
} from '@/api/kickbase';
import type { PlaceOfferInput, PlayerDetail, SaveLineupInput } from '@/api/kickbase';
import { useAuth } from '@/auth/AuthProvider';
import { mockLineupData } from '@/mock/mockLineup';
import type { PlaytimeTotals } from '@/utils/playtime';
import { latestSeason, sumPlaytime } from '@/utils/playtime';
import { queryKeys } from './keys';

/**
 * Auf true setzen, um lokal mit einem größeren Test-Kader (23 statt z. B. 11
 * Spieler, siehe src/mock/mockLineup.ts) gegen den Aufstellungs-Optimizer zu
 * arbeiten. Login und Liga-Auswahl bleiben live — nur Kader/Aufstellung wird
 * ersetzt (der Kader-Filter im Spieler-Tab hängt am selben Hook und zeigt den
 * Mock-Kader automatisch mit). Vor dem Commit wieder auf false zurücksetzen.
 */
const USE_MOCK_LINEUP = false;

export function useLeagues() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.leagues(),
    queryFn: () => getLeagues(token!),
    enabled: !!token,
    staleTime: 5 * 60_000,
  });
}

export function useLineup(leagueId: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.lineup(leagueId),
    queryFn: () => (USE_MOCK_LINEUP ? Promise.resolve(mockLineupData) : getLineup(token!, leagueId)),
    enabled: USE_MOCK_LINEUP || (!!token && !!leagueId),
    staleTime: 60_000,
  });
}

export function useMarket(leagueId: string, options: { enabled?: boolean } = {}) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.market(leagueId),
    queryFn: () => getMarket(token!, leagueId),
    enabled: !!token && !!leagueId && (options.enabled ?? true),
    staleTime: 60_000,
  });
}

/**
 * Liga-Tabelle (Platzierung, Punkte, Teamwert je Manager, plus dessen
 * Startelf-IDs). Ohne `dayNumber` die Saisonwertung — deren `lp[]` ist der
 * Stand des zuletzt abgerechneten Spieltags und damit für die Rivalen-Elf zu
 * alt; wer die aktuelle Elf will, übergibt den Spieltag (siehe
 * resolveLineupMatchday() und manager/[managerId].tsx).
 *
 * `live` = der Spieltag läuft gerade: dann kurz cachen und im Hintergrund
 * nachziehen, damit Ein-/Auswechslungen ohne Pull-to-Refresh ankommen.
 */
export function useLeagueRanking(
  leagueId: string,
  dayNumber?: number,
  options: { enabled?: boolean; live?: boolean } = {},
) {
  const { token } = useAuth();
  const { enabled = true, live = false } = options;
  return useQuery({
    queryKey: queryKeys.leagueRanking(leagueId, dayNumber),
    queryFn: () => getLeagueRanking(token!, leagueId, dayNumber),
    enabled: !!token && !!leagueId && enabled,
    staleTime: live ? 15_000 : 60_000,
    refetchInterval: live ? 60_000 : false,
  });
}

/**
 * Liga-Einstellungen (`mpst`/`mppu`) — ändern sich fast nie, deshalb eine
 * lange Stale-Time. Genutzt als Vorbelegung für die lokale maxPerTeam-Regel,
 * siehe LeagueRulesContext.tsx.
 */
export function useLeagueOverview(leagueId: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.leagueOverview(leagueId),
    queryFn: () => getLeagueOverview(token!, leagueId),
    enabled: !!token && !!leagueId,
    staleTime: 15 * 60_000,
  });
}

export interface ManagerLineupState {
  /** playerId → Basis-Spielerdaten. Eintrag fehlt, solange der Request läuft oder scheitert. */
  players: Map<string, PlayerDetail>;
  pending: number;
  total: number;
  /** Erfüllt das Refetchable-Interface von useRefresh (Pull-to-Refresh). */
  refetch: () => Promise<unknown>;
}

/**
 * Löst die Startelf-Spieler-IDs eines Rivalen (LeagueRankingEntry.lineupPlayerIds)
 * zu Basis-Spielerdaten auf — ein `getPlayerBasic`-Request je ID, gedrosselt
 * über withPlayerLookupLimit (siehe limiter.ts). Analog zu usePlaytimes() oben:
 * `playerIds` muss stabil sein (useMemo beim Aufrufer).
 */
export function useManagerLineup(leagueId: string, playerIds: readonly (string | null)[]): ManagerLineupState {
  const { token } = useAuth();
  const ids = playerIds.filter((id): id is string => id !== null);
  const results = useQueries({
    queries: ids.map((playerId) => ({
      queryKey: queryKeys.playerBasic(leagueId, playerId),
      queryFn: () => getPlayerBasic(token!, leagueId, playerId),
      enabled: !!token && !!leagueId && !!playerId,
      staleTime: 5 * 60_000,
    })),
  });

  const players = useMemo(() => {
    const map = new Map<string, PlayerDetail>();
    results.forEach((result, index) => {
      const playerId = ids[index];
      if (playerId && result.data) map.set(playerId, result.data);
    });
    return map;
  }, [results, playerIds]);

  const pending = results.reduce((count, r) => (r.isPending ? count + 1 : count), 0);
  const refetch = useCallback(() => Promise.all(results.map((r) => r.refetch())), [results]);

  return { players, pending, total: ids.length, refetch };
}

export function usePlayer(leagueId: string, playerId: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.player(leagueId, playerId),
    queryFn: () => getPlayer(token!, leagueId, playerId),
    enabled: !!token && !!leagueId && !!playerId,
    staleTime: 5 * 60_000,
  });
}

export interface PlaytimeState {
  /** playerId → Saison-Aggregat. Eintrag fehlt, solange der Request läuft oder scheitert. */
  playtimes: Map<string, PlaytimeTotals>;
  /** Noch laufende Requests — für den Lade-Hinweis im Kader- und im Markt-Tab. */
  pending: number;
  /** Gesamtzahl der Spieler, für die Spielzeit abgefragt wird. */
  total: number;
  /** Erfüllt das Refetchable-Interface von useRefresh (Pull-to-Refresh). */
  refetch: () => Promise<unknown>;
}

/**
 * Spielzeit-Aggregat je Spieler, Basis der Punkte/Min-Kennzahl im Spieler-
 * und im Markt-Tab.
 *
 * Ein `/performance`-Request PRO Spieler, weil Kickbase in Kader- und
 * Marktlisten kein Minutenfeld liefert. Eigener Cache-Key je Spieler, damit
 * beim Wechsel Spieler↔Transfermarkt und beim Zurückkehren in den Tab keine
 * Requests doppelt laufen — Spieler, die in beiden Listen auftauchen, werden
 * nur einmal geholt. Die Parallelität begrenzt das Gate in
 * src/api/kickbase/limiter.ts.
 *
 * `playerIds` muss stabil sein (useMemo beim Aufrufer), sonst baut useQueries
 * die Query-Liste bei jedem Render neu auf.
 */
export function usePlaytimes(leagueId: string, playerIds: string[]): PlaytimeState {
  const { token } = useAuth();
  const results = useQueries({
    queries: playerIds.map((playerId) => ({
      queryKey: queryKeys.playerPerformance(leagueId, playerId),
      queryFn: () => getPlayerPerformance(token!, leagueId, playerId),
      enabled: !!token && !!leagueId && !!playerId,
      staleTime: 5 * 60_000,
    })),
  });

  const playtimes = useMemo(() => {
    const map = new Map<string, PlaytimeTotals>();
    results.forEach((result, index) => {
      const playerId = playerIds[index];
      const season = result.data ? latestSeason(result.data) : undefined;
      if (playerId && season) map.set(playerId, sumPlaytime(season.matchdays));
    });
    return map;
  }, [results, playerIds]);

  const refetch = useCallback(() => Promise.all(results.map((r) => r.refetch())), [results]);

  // isPending statt "erwartet minus geladen": ein fehlgeschlagener Request wäre
  // sonst dauerhaft "pending" und der Lade-Hinweis würde nie verschwinden.
  const pending = results.reduce((count, r) => (r.isPending ? count + 1 : count), 0);

  return { playtimes, pending, total: playerIds.length, refetch };
}

/** Teams einer Competition (Namen + Logos) — ändern sich höchstens saisonweise. */
export function useCompetitionTeams(competitionId: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.competitionTeams(competitionId ?? ''),
    queryFn: () => getCompetitionTeams(token!, competitionId!),
    enabled: !!token && !!competitionId,
    staleTime: 24 * 60 * 60_000,
  });
}

/**
 * Der competition-weite Spielerbestand des Spieler-Tabs — alle Spieler der
 * Bundesliga, nicht nur eigene und gelistete.
 *
 * Kostet einen Request PRO VEREIN (siehe getCompetitionPlayers), deshalb
 * bewusst lange frisch: Punkte ändern sich nur spieltags, Marktwerte nur beim
 * nächtlichen Update. `teamIds` steht absichtlich NICHT im Query-Key — die
 * Liste kommt aus `useCompetitionTeams` und ist pro Competition konstant; im
 * Key würde jede neu geladene Vereinsliste den Cache wegwerfen.
 */
export function useCompetitionPlayers(competitionId: string | null, teamIds: readonly string[] | undefined) {
  const { token } = useAuth();
  const ids = teamIds ?? [];
  return useQuery({
    queryKey: queryKeys.competitionPlayers(competitionId ?? ''),
    queryFn: () => getCompetitionPlayers(token!, competitionId!, ids),
    enabled: !!token && !!competitionId && ids.length > 0,
    staleTime: 30 * 60_000,
  });
}

/** Spielplan der Competition (Anstoßzeiten je Spieltag) — ändert sich höchstens wöchentlich. */
export function useMatchdays(competitionId: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.matchdays(competitionId ?? ''),
    queryFn: () => getMatchdays(token!, competitionId!),
    enabled: !!token && !!competitionId,
    staleTime: 15 * 60_000,
  });
}

export function useSaveLineup(leagueId: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveLineupInput) => saveLineup(token!, leagueId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lineup(leagueId) });
    },
  });
}

/**
 * Gebot abgeben oder ändern (POST ist ein Upsert, siehe endpoints.ts).
 * Invalidiert zusätzlich `leagues`, weil ein sofort angenommenes Gebot
 * (Bot-Listing) den Kontostand ändert, den der 33%-Überziehungsrahmen
 * (useBudgetLimit) braucht — sonst bliebe er bis zu 5 Minuten stale.
 */
export function usePlaceOffer(leagueId: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlaceOfferInput) => placeOffer(token!, leagueId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.market(leagueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leagues() });
    },
  });
}

/** Eigenes Gebot zurückziehen. `offerId` = `MarketPlayer.ownOfferId`. */
export function useRemoveOffer(leagueId: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playerId, offerId }: { playerId: string; offerId: string }) =>
      removeOffer(token!, leagueId, playerId, offerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.market(leagueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leagues() });
    },
  });
}
