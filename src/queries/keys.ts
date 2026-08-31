/** Zentrale Query-Keys, damit Invalidierung nicht aus dem Ruder läuft. */
export const queryKeys = {
  leagues: () => ['leagues'] as const,
  lineup: (leagueId: string) => ['lineup', leagueId] as const,
  market: (leagueId: string) => ['market', leagueId] as const,
  player: (leagueId: string, playerId: string) => ['player', leagueId, playerId] as const,
  competitionTeams: (competitionId: string) => ['competitionTeams', competitionId] as const,
  matchdays: (competitionId: string) => ['matchdays', competitionId] as const,
};
