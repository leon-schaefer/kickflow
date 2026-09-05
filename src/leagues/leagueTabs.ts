/** Tab-Titel einmalig: benennen die Tabs und liefern das Zurück-Label im Detail. */
export const leagueTabTitles = {
  lineup: 'Aufstellung',
  players: 'Spieler',
  market: 'Markt',
  league: 'Liga',
  more: 'Mehr',
} as const;

export type LeagueTabName = keyof typeof leagueTabTitles;

/**
 * Tab-Titel zu einem Pfad wie `/42/market` — `null` außerhalb der fünf Tabs.
 *
 * Damit kann eine Komponente, die auf mehreren Tabs sitzt (der
 * LeagueSwitcher), ihre Herkunft mitgeben, ohne selbst zu wissen, in welchem
 * Tab sie gerade steckt.
 */
export function leagueTabTitleForPath(pathname: string): string | null {
  // `/42/market` → ['', '42', 'market']; kürzere Pfade liefern undefined.
  const segment = pathname.split('/')[2] ?? '';
  return Object.hasOwn(leagueTabTitles, segment)
    ? leagueTabTitles[segment as LeagueTabName]
    : null;
}
