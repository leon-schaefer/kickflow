/** Tab-Titel einmalig: benennen die Tabs und liefern das Zurück-Label im Detail. */
export const leagueTabTitles = {
  lineup: 'Aufstellung',
  players: 'Spieler',
  market: 'Markt',
  league: 'Liga',
  more: 'Mehr',
} as const;

export type LeagueTabName = keyof typeof leagueTabTitles;
