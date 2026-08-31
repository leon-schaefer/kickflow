import { createContext, use } from 'react';

/**
 * Der `leagueId`-Param aus `[leagueId]`, einmal im Layout gelesen und an alle
 * Kinder gereicht. Grund: `useLocalSearchParams()` in einem Tab-Screen liefert
 * nur für den aus der URL gematchten Tab den Param — Geschwister-Tabs (z.B.
 * "Kader", wenn "Aufstellung" initial aktiv ist) bekommen `{}`, weil der
 * Tab-Router beim State-Aufbau nur der gematchten Route Params zuweist
 * (siehe expo-router TabRouter.getRehydratedState). Der Param der `[leagueId]`
 * Route selbst ist dagegen immer vorhanden, weil sie die aus der URL
 * gematchte Route im umgebenden Stack ist.
 */
const LeagueIdContext = createContext<string | null>(null);

export function LeagueIdProvider({
  id,
  children,
}: {
  id: string | undefined;
  children: React.ReactNode;
}) {
  return <LeagueIdContext.Provider value={id ?? null}>{children}</LeagueIdContext.Provider>;
}

/** Immer ein string — der Provider sitzt in app/(app)/[leagueId]/_layout.tsx. */
export function useLeagueId(): string {
  const id = use(LeagueIdContext);
  if (!id) throw new Error('useLeagueId() muss innerhalb von [leagueId] aufgerufen werden.');
  return id;
}
