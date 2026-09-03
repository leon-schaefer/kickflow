/** Zentrale Query-Keys, damit Invalidierung nicht aus dem Ruder läuft. */
export const queryKeys = {
  leagues: () => ['leagues'] as const,
  lineup: (leagueId: string) => ['lineup', leagueId] as const,
  market: (leagueId: string) => ['market', leagueId] as const,
  player: (leagueId: string, playerId: string) => ['player', leagueId, playerId] as const,
  playerPerformance: (leagueId: string, playerId: string) =>
    ['playerPerformance', leagueId, playerId] as const,
  competitionTeams: (competitionId: string) => ['competitionTeams', competitionId] as const,
  /** Competition-weiter Spielerbestand (Spieler-Tab) — die Vereinsliste steckt bewusst nicht im Key, siehe useCompetitionPlayers. */
  competitionPlayers: (competitionId: string) => ['competitionPlayers', competitionId] as const,
  matchdays: (competitionId: string) => ['matchdays', competitionId] as const,
  leagueRanking: (leagueId: string, dayNumber?: number) =>
    ['leagueRanking', leagueId, dayNumber ?? 'season'] as const,
  leagueOverview: (leagueId: string) => ['leagueOverview', leagueId] as const,
  /** Basis-Spielerdaten für die Rivalen-Elf (getPlayerBasic) — eigener Key, damit sie nicht mit `player` (voller Detail-Query) kollidieren. */
  playerBasic: (leagueId: string, playerId: string) => ['playerBasic', leagueId, playerId] as const,
};
