import { createContext, use } from 'react';
import { useExcludedFromSale, type ExcludedFromSale } from './useExcludedFromSale';

/**
 * Genau eine Instanz der Verkaufs-Ausschlüsse pro Liga, im Layout gemountet —
 * aus demselben Grund wie LeagueRulesContext: der Ausschluss wird auf dem
 * Spieler-Detail-Screen umgeschaltet, wirkt aber im darunter weiterhin
 * montierten Aufstellungs-Tab (Verkaufsvorschlag + Kontoausgleich). Zwei
 * `useExcludedFromSale`-Instanzen hätten getrennte States, und der Tab würde
 * den frisch gesetzten Ausschluss nicht mitbekommen.
 */
const ExcludedFromSaleContext = createContext<ExcludedFromSale | null>(null);

export function ExcludedFromSaleProvider({
  leagueId,
  children,
}: {
  leagueId: string | undefined;
  children: React.ReactNode;
}) {
  // Wie im LeagueRulesProvider: `leagueId` ist hier praktisch immer gesetzt,
  // der Fallback hält nur die Hook-Reihenfolge stabil.
  const value = useExcludedFromSale(leagueId ?? '');
  return <ExcludedFromSaleContext.Provider value={leagueId ? value : null}>{children}</ExcludedFromSaleContext.Provider>;
}

/** Der Provider sitzt in app/(app)/[leagueId]/_layout.tsx — Vorbild: useLeagueRulesContext(). */
export function useExcludedFromSaleContext(): ExcludedFromSale {
  const value = use(ExcludedFromSaleContext);
  if (!value) throw new Error('useExcludedFromSaleContext() muss innerhalb von [leagueId] aufgerufen werden.');
  return value;
}
