import { createContext, use } from 'react';
import { useLeagueRules, type LeagueRules } from './useLeagueRules';

/**
 * Genau eine Instanz des Regel-States pro Liga, im Layout gemountet.
 *
 * Grund: Die Regeln werden an zwei Stellen gebraucht — im Aufstellungs-Tab
 * (Anzeige in OptimizerBar + harte Schranken für den Optimizer) und auf dem
 * Regel-Screen, der per `router.push` ÜBER dem weiterhin montierten Tab liegt.
 * `useLeagueRules` direkt in beiden Screens aufzurufen ergab zwei unabhängige
 * `useState`-Instanzen: Das Einschalten einer Regel aktualisierte nur den
 * Regel-Screen und AsyncStorage, während der Tab dauerhaft auf dem Default
 * (`enabled: false`) stehen blieb — sichtbar als "Keine Regeln aktiv", und der
 * Optimizer rechnete tatsächlich ohne die Regel weiter.
 */
const LeagueRulesContext = createContext<LeagueRules | null>(null);

export function LeagueRulesProvider({
  leagueId,
  children,
}: {
  leagueId: string | undefined;
  children: React.ReactNode;
}) {
  // `leagueId` ist hier praktisch immer gesetzt (die Route hat gematcht); der
  // Fallback hält nur die Hook-Reihenfolge stabil und liefert dann bewusst
  // `null`, damit Konsumenten denselben klaren Fehler sehen wie bei useLeagueId().
  const value = useLeagueRules(leagueId ?? '');
  return <LeagueRulesContext.Provider value={leagueId ? value : null}>{children}</LeagueRulesContext.Provider>;
}

/** Der Provider sitzt in app/(app)/[leagueId]/_layout.tsx — Vorbild: useLeagueId(). */
export function useLeagueRulesContext(): LeagueRules {
  const value = use(LeagueRulesContext);
  if (!value) throw new Error('useLeagueRulesContext() muss innerhalb von [leagueId] aufgerufen werden.');
  return value;
}
