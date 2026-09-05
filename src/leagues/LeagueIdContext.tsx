import { createContext, use } from 'react';

/**
 * Der `leagueId`-Param aus `/:leagueId`, einmal im Layout gelesen und an alle
 * Kinder gereicht.
 *
 * Der ursprüngliche Grund ist mit expo-router weg: dort lieferte
 * `useLocalSearchParams()` in einem Tab-Screen nur für den aus der URL
 * gematchten Tab den Param, Geschwister-Tabs bekamen `{}` (der Tab-Router
 * wies beim State-Aufbau nur der gematchten Route Params zu, siehe
 * TabRouter.getRehydratedState). React Routers `useParams()` liest die ganze
 * Match-Kette und hat das Problem nicht.
 *
 * Der Context bleibt trotzdem: `useLeagueId()` wird breit konsumiert, und
 * seine Zusage ist stärker als die von `useParams()` — er gibt immer einen
 * string zurück statt `string | undefined`, weil der Provider genau eine
 * Ebene über allen Konsumenten sitzt und den Fehlerfall dort einmal behandelt.
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

/** Immer ein string — der Provider sitzt in src/routes/LeagueLayout.tsx. */
export function useLeagueId(): string {
  const id = use(LeagueIdContext);
  if (!id) throw new Error('useLeagueId() muss innerhalb von [leagueId] aufgerufen werden.');
  return id;
}
