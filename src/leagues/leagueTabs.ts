/** Tab-Titel einmalig: benennen die Tabs und liefern das Zurück-Label im Detail. */
export const leagueTabTitles = {
  lineup: 'Aufstellung',
  players: 'Spieler',
  market: 'Markt',
  league: 'Liga',
  more: 'Mehr',
} as const;

export type LeagueTabName = keyof typeof leagueTabTitles;

// Absichtlich strukturell statt `NavigationState`, damit die Funktion ohne
// Navigator testbar bleibt (deckt NavigationState und PartialState ab).
export type TabsAwareRoute = { name: string; state?: TabsAwareState };
export type TabsAwareState = { index?: number; routes: readonly TabsAwareRoute[] };

/**
 * Titel der Screens, die im `[leagueId]`-Stack ÜBER den Tabs liegen und
 * selbst weiterpushen können — nur von dort aus ist ihr Titel das
 * Zurück-Label des obersten Screens. Muss zu den Routennamen in
 * src/routes/routes.tsx passen.
 */
const leagueStackTitles: Record<string, string> = {
  'manager/[managerId]': 'Manager',
};

/**
 * Zurück-Label des obersten Screens im `[leagueId]`-Stack: der Titel des
 * Screens DARUNTER. Das ist meistens die Tab-Gruppe (`'(tabs)'`), dann
 * gewinnt der Titel des fokussierten Tabs; liegt darunter dagegen ein
 * eigener Stack-Screen — etwa die Manager-Ansicht, aus der heraus ein
 * Spielerprofil gepusht wird —, ist dessen Titel gemeint. Ohne diese
 * Unterscheidung stünde dort „Liga“, obwohl das Zurück auf den Rivalen führt.
 * Fallback „Aufstellung“: ohne Tab-State (Deep Link direkt aufs Detail) landet
 * ein Zurück auf dem ersten Tab, und das ist `lineup`.
 */
export function focusedLeagueTabTitle(state: TabsAwareState | undefined): string {
  const routes = state?.routes ?? [];
  const below = routes[(state?.index ?? routes.length - 1) - 1];
  if (below && below.name !== '(tabs)') {
    return leagueStackTitles[below.name] ?? leagueTabTitles.lineup;
  }

  const tabs = routes.find((route) => route.name === '(tabs)')?.state;
  const focused = tabs?.routes[tabs.index ?? tabs.routes.length - 1]?.name;
  return leagueTabTitles[focused as LeagueTabName] ?? leagueTabTitles.lineup;
}
