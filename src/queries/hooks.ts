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
  getPlayerTransferHistory,
  listPlayerOnMarket,
  placeOffer,
  removeOffer,
  removePlayerFromMarket,
  saveLineup,
} from '@/api/kickbase';
import type {
  ListPlayerInput,
  PlaceOfferInput,
  PlayerDetail,
  PlayerTransfer,
  SaveLineupInput,
} from '@/api/kickbase';
import { useAuth } from '@/auth/AuthProvider';
import { mockLineupData } from '@/mock/mockLineup';
import { resolveOwnPurchase } from '@/utils/playerPurchase';
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

export function useLineup(leagueId: string, options: { enabled?: boolean } = {}) {
  const { token } = useAuth();
  const { enabled = true } = options;
  return useQuery({
    queryKey: queryKeys.lineup(leagueId),
    queryFn: () => (USE_MOCK_LINEUP ? Promise.resolve(mockLineupData) : getLineup(token!, leagueId)),
    enabled: USE_MOCK_LINEUP || (!!token && !!leagueId && enabled),
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

/**
 * Transferhistorie eines Spielers — Quelle des Kaufdatums im Spieler-Screen.
 *
 * Ein Zusatzrequest, der nur für EIGENE Spieler laufen soll: bei fremden
 * Spielern gibt es daraus nichts anzuzeigen. Deshalb `enabled` beim Aufrufer
 * (siehe src/screens/PlayerDetailScreen.tsx) statt hier fest an.
 * Lange staleTime, weil ein vergangener Transfer sich nicht mehr ändert und
 * ein neuer Kauf ohnehin über Pull-to-Refresh ankommt.
 */
export function usePlayerTransfers(
  leagueId: string,
  playerId: string,
  options: { enabled?: boolean } = {},
) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.playerTransfers(leagueId, playerId),
    queryFn: () => getPlayerTransferHistory(token!, leagueId, playerId),
    enabled: !!token && !!leagueId && !!playerId && (options.enabled ?? true),
    staleTime: 15 * 60_000,
  });
}

export interface PurchaseState {
  /** playerId → eigener Kauf. Eintrag fehlt, solange der Request läuft, scheitert oder sich kein Kauf belegen lässt. */
  purchases: Map<string, PlayerTransfer>;
  /** Noch laufende Requests — für den Lade-Hinweis in der Kaufen/Verkaufen-Liste. */
  pending: number;
  /** Gesamtzahl der Spieler, für die die Historie abgefragt wird. */
  total: number;
}

/**
 * "Für wie viel habe ich den gekauft?" für eine ganze Spielerliste — dieselbe
 * Quelle wie die Kaufdatum-Zeile im Spieler-Screen (getPlayerTransferHistory,
 * ausgewertet von resolveOwnPurchase), nur für den Kader auf einmal.
 *
 * Ein Request PRO Spieler, weil Kickbase in der Kaderantwort weder Kaufpreis
 * noch Kaufdatum liefert (siehe rawSquadPlayerSchema). Deshalb zwei Bremsen:
 * das Gate in src/api/kickbase/limiter.ts hält den Burst von Cloudflare fern,
 * und der Aufrufer schaltet die Abfrage über `enabled` erst frei, wenn die
 * Liste wirklich aufgeklappt ist (siehe SellAdviceSection). Der Cache-Key ist
 * derselbe wie in usePlayerTransfers — wer vorher im Spieler-Screen war,
 * bezahlt den Request kein zweites Mal.
 *
 * `inOwnSquad: true` ist hier korrekt und keine Annahme: aufgerufen wird das
 * nur mit den eigenen Kaderspielern. Fällt ein Request aus, fehlt schlicht der
 * Eintrag — die Liste zeigt den Spieler dann ohne Kaufpreis.
 *
 * `playerIds` muss stabil sein (useMemo beim Aufrufer), sonst baut useQueries
 * die Query-Liste bei jedem Render neu auf.
 */
export function usePurchases(
  leagueId: string,
  playerIds: string[],
  options: { enabled?: boolean } = {},
): PurchaseState {
  // `userId` von hier statt als Parameter: der Hook hängt für den Token
  // ohnehin an useAuth, und so braucht der aufrufende Screen den
  // Auth-Kontext nicht selbst.
  const { token, userId } = useAuth();
  const enabled = options.enabled ?? true;
  const results = useQueries({
    queries: playerIds.map((playerId) => ({
      queryKey: queryKeys.playerTransfers(leagueId, playerId),
      queryFn: () => getPlayerTransferHistory(token!, leagueId, playerId),
      enabled: enabled && !!token && !!leagueId && !!playerId,
      staleTime: 15 * 60_000,
    })),
  });

  const purchases = useMemo(() => {
    const map = new Map<string, PlayerTransfer>();
    results.forEach((result, index) => {
      const playerId = playerIds[index];
      if (!playerId || !result.data) return;
      const purchase = resolveOwnPurchase({
        transfers: result.data,
        ownUserId: userId,
        inOwnSquad: true,
      });
      if (purchase) map.set(playerId, purchase);
    });
    return map;
  }, [results, playerIds, userId]);

  // isPending statt "erwartet minus geladen": ein fehlgeschlagener Request wäre
  // sonst dauerhaft "pending" (Vorbild usePlaytimes unten). Ist die Abfrage gar
  // nicht freigeschaltet, meldet useQueries die Einträge ebenfalls als pending —
  // ohne laufende Requests soll die Liste aber keinen Ladehinweis zeigen.
  const pending = enabled ? results.reduce((count, r) => (r.isPending ? count + 1 : count), 0) : 0;

  return { purchases, pending, total: playerIds.length };
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

/**
 * Eigenen Spieler auf den Transfermarkt stellen (bzw. seinen Angebotspreis
 * ändern, siehe listPlayerOnMarket in endpoints.ts).
 *
 * Invalidiert `lineup` mit: `SquadPlayer.onMarket` kommt aus der Kader-Antwort
 * (`iotm`), und genau daran erkennt der Aufstellungs-Screen, welche
 * Verkaufskandidaten schon stehen. Anders als beim Bieten bleibt `leagues`
 * unangetastet — ein Listing bewegt den Kontostand nicht, das tut erst der
 * Verkauf.
 */
export function useListPlayerOnMarket(leagueId: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ListPlayerInput) => listPlayerOnMarket(token!, leagueId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lineup(leagueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.market(leagueId) });
    },
  });
}

/** Eigenen Spieler wieder vom Transfermarkt nehmen — Gegenstück zu useListPlayerOnMarket. */
export function useRemovePlayerFromMarket(leagueId: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (playerId: string) => removePlayerFromMarket(token!, leagueId, playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lineup(leagueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.market(leagueId) });
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
