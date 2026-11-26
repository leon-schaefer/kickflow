import { useQueryClient } from '@tanstack/react-query';
import {
  getCompetitionPlayers, getCompetitionTeams, getPlayer, getPlayerPerformance,
} from '@/api/kickbase';
import { useAuth } from '@/auth/AuthProvider';
import { queryKeys } from '@/queries/keys';
import { latestSeason } from '@/utils/playtime';

interface PlayerReference {
  id: string;
  name: string;
  teamId: string;
}

function normalize(name: string) {
  return name.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('de').trim();
}

function findPlayers(players: readonly PlayerReference[], term: string) {
  const exact = players.filter((player) => player.id === term || normalize(player.name) === term);
  return exact.length ? exact : players.filter((player) => normalize(player.name).includes(term));
}

export function usePlayerLookup(leagueId: string, competitionId: string | null) {
  const { token } = useAuth();
  const cache = useQueryClient();

  return async (query: string, knownPlayers: readonly PlayerReference[], signal: AbortSignal) => {
    try {
      if (!token) return { error: 'Die Kickbase-Anmeldung fehlt.' };
      signal.throwIfAborted();
      const term = normalize(query);
      const known = [...new Map(knownPlayers.map((player) => [player.id, player])).values()];
      let matches = known.filter((player) => player.id === term || normalize(player.name) === term);
      if (matches.length === 0 && competitionId) {
        const teams = await cache.fetchQuery({
          queryKey: queryKeys.competitionTeams(competitionId),
          queryFn: () => getCompetitionTeams(token, competitionId),
          staleTime: 24 * 60 * 60_000,
        });
        signal.throwIfAborted();
        const players = await cache.fetchQuery({
          queryKey: queryKeys.competitionPlayers(competitionId),
          queryFn: () => getCompetitionPlayers(token, competitionId, teams.map((team) => team.id)),
          staleTime: 30 * 60_000,
        });
        matches = findPlayers([...new Map([...known, ...players].map((player) => [player.id, player])).values()], term);
      } else if (matches.length === 0) {
        matches = findPlayers(known, term);
      }
      signal.throwIfAborted();
      if (matches.length === 0) return { error: 'Kein passender Spieler gefunden.' };
      if (matches.length > 1) {
        return {
          error: 'Mehrere Spieler gefunden. Mit genauerem Namen oder Spieler-ID erneut abfragen.',
          matches: matches.slice(0, 8).map(({ id, name, teamId }) => ({ id, name, teamId })),
        };
      }

      const { id } = matches[0];
      const player = await cache.fetchQuery({
        queryKey: queryKeys.player(leagueId, id),
        queryFn: () => getPlayer(token, leagueId, id, () => cache.fetchQuery({
          queryKey: queryKeys.playerPerformance(leagueId, id),
          queryFn: () => getPlayerPerformance(token, leagueId, id),
          staleTime: 5 * 60_000,
        })),
        staleTime: 5 * 60_000,
      });
      signal.throwIfAborted();
      return {
        id: player.id,
        name: player.name,
        club: player.teamName,
        position: player.position,
        status: player.status,
        statusDetails: player.statusDetails,
        marketValue: player.marketValue,
        marketValueTrend: player.marketValueTrend,
        marketValueHistory: player.marketValueHistory92.points
          .toSorted((a, b) => a.date - b.date).slice(-14),
        kickbaseAveragePoints: player.averagePoints,
        goals: player.goals,
        assists: player.assists,
        recentMatchdays: latestSeason(player.performance)?.matchdays
          .filter((day) => day.hasResult)
          .toSorted((a, b) => b.matchday - a.matchday).slice(0, 8)
          .map(({ matchday, matchDate, points, minutesPlayed }) => ({ matchday, matchDate, points, minutesPlayed })),
      };
    } catch {
      signal.throwIfAborted();
      return { error: 'Kickbase konnte die Spielerdaten gerade nicht laden.' };
    }
  };
}
