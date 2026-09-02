import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  getCompetitionTeams,
  getLeagueRanking,
  getLeagues,
  getLineup,
  getManagerSquad,
  getMarket,
  getMatchdays,
  getPlayer,
  getPlayerPerformance,
  placeOffer,
  removeOffer,
  saveLineup,
} from '@/api/kickbase';
import type { PlaceOfferInput, SaveLineupInput } from '@/api/kickbase';
import { useAuth } from '@/auth/AuthProvider';
import { mockLineupData } from '@/mock/mockLineup';
import type { PlaytimeTotals } from '@/utils/playtime';
import { latestSeason, sumPlaytime } from '@/utils/playtime';
import { queryKeys } from './keys';

/**
 * Auf true setzen, um lokal mit einem größeren Test-Kader (23 statt z. B. 11
 * Spieler, siehe src/mock/mockLineup.ts) gegen den Aufstellungs-Optimizer zu
 * arbeiten. Login und Liga-Auswahl bleiben live — nur Kader/Aufstellung wird
 * ersetzt (Squad- und Value-Tab hängen an demselben Hook und zeigen den
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

/**
 * Die Liga-Tabelle (alle Manager). `staleTime` wie beim Markt: Punkte und
 * Teamwerte ändern sich höchstens im Minutentakt, ein Tab-Wechsel muss dafür
 * keinen Request auslösen.
 */
export function useLeagueRanking(leagueId: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.leagueRanking(leagueId),
    queryFn: () => getLeagueRanking(token!, leagueId),
    enabled: !!token && !!leagueId,
    staleTime: 60_000,
  });
}

/** Kader + Startelf eines Managers — die Rivalen-Ansicht. */
export function useManagerSquad(leagueId: string, managerId: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.managerSquad(leagueId, managerId),
    queryFn: () => getManagerSquad(token!, leagueId, managerId),
    enabled: !!token && !!leagueId && !!managerId,
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
  /** Noch laufende Requests — für den Lade-Hinweis im Wert-Tab. */
  pending: number;
  /** Gesamtzahl der Spieler, für die Spielzeit abgefragt wird. */
  total: number;
  /** Erfüllt das Refetchable-Interface von useRefresh (Pull-to-Refresh). */
  refetch: () => Promise<unknown>;
}

/**
 * Spielzeit-Aggregat je Spieler, Basis der Punkte/Min-Spalte im Wert-Tab.
 *
 * Ein `/performance`-Request PRO Spieler, weil Kickbase in Kader- und
 * Marktlisten kein Minutenfeld liefert. Eigener Cache-Key je Spieler, damit
 * beim Wechsel Kader↔Transfermarkt und beim Zurückkehren in den Tab keine
 * Requests doppelt laufen — Spieler, die in beiden Segmenten auftauchen, werden
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
