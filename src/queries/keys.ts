/** Zentrale Query-Keys, damit Invalidierung nicht aus dem Ruder läuft. */
export const queryKeys = {
  leagues: () => ['leagues'] as const,
  lineup: (leagueId: string) => ['lineup', leagueId] as const,
  market: (leagueId: string) => ['market', leagueId] as const,
  leagueRanking: (leagueId: string) => ['leagueRanking', leagueId] as const,
  managerSquad: (leagueId: string, managerId: string) =>
    ['managerSquad', leagueId, managerId] as const,
  player: (leagueId: string, playerId: string) => ['player', leagueId, playerId] as const,
  playerPerformance: (leagueId: string, playerId: string) =>
    ['playerPerformance', leagueId, playerId] as const,
  competitionTeams: (competitionId: string) => ['competitionTeams', competitionId] as const,
  matchdays: (competitionId: string) => ['matchdays', competitionId] as const,
};
