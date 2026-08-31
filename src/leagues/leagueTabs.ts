/** Tab-Titel einmalig: benennen die Tabs und liefern das Zurück-Label im Detail. */
export const leagueTabTitles = {
  lineup: 'Aufstellung',
  squad: 'Kader',
  value: 'Wert',
} as const;

export type LeagueTabName = keyof typeof leagueTabTitles;

// Absichtlich strukturell statt `NavigationState`, damit die Funktion ohne
// Navigator testbar bleibt (deckt NavigationState und PartialState ab).
export type TabsAwareRoute = { name: string; state?: TabsAwareState };
export type TabsAwareState = { index?: number; routes: readonly TabsAwareRoute[] };

/**
 * Titel des fokussierten Liga-Tabs, gelesen aus dem State des
 * `[leagueId]`-Stacks. `'(tabs)'` ist dort der Routenname der Tab-Gruppe.
 * Fallback „Aufstellung“: ohne Tab-State (Deep Link direkt aufs Detail) landet
 * ein Zurück auf dem ersten Tab, und das ist `lineup`.
 */
export function focusedLeagueTabTitle(state: TabsAwareState | undefined): string {
  const tabs = state?.routes.find((route) => route.name === '(tabs)')?.state;
  const focused = tabs?.routes[tabs.index ?? tabs.routes.length - 1]?.name;
  return leagueTabTitles[focused as LeagueTabName] ?? leagueTabTitles.lineup;
}
