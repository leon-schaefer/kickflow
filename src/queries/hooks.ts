import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCompetitionTeams,
  getLeagues,
  getLineup,
  getMarket,
  getMatchdays,
  getPlayer,
  saveLineup,
} from '@/api/kickbase';
import type { SaveLineupInput } from '@/api/kickbase';
import { useAuth } from '@/auth/AuthProvider';
import { mockLineupData } from '@/mock/mockLineup';
import { queryKeys } from './keys';

/**
 * Auf true setzen, um lokal mit einem größeren Test-Kader (23 statt z. B. 11
 * Spieler, siehe src/mock/mockLineup.ts) gegen den Aufstellungs-Optimizer zu
 * arbeiten. Login und Liga-Auswahl bleiben live — nur Kader/Aufstellung wird
 * ersetzt (Squad- und Value-Tab hängen an demselben Hook und zeigen den
 * Mock-Kader automatisch mit). Vor dem Commit wieder auf false zurücksetzen.
 */
const USE_MOCK_LINEUP = true;

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

export function usePlayer(leagueId: string, playerId: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.player(leagueId, playerId),
    queryFn: () => getPlayer(token!, leagueId, playerId),
    enabled: !!token && !!leagueId && !!playerId,
    staleTime: 5 * 60_000,
  });
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
