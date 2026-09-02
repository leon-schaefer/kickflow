import { useMemo } from 'react';
import { useMarket } from '@/queries/hooks';
import { type BudgetLimit, computeBudgetLimit, sumOpenOffers } from '@/utils/budget';
import { useLeagueId } from './LeagueIdContext';
import { useCurrentLeague } from './useCurrentLeague';

/**
 * Der Kickbase-„33%-Überziehungsrahmen" (utils/budget.ts) für die aktuelle
 * Liga, inklusive der Summe der eigenen offenen Gebote. Nutzt dieselbe
 * `useMarket`-Query wie die Wert-Seite (queryKeys.market), erzeugt also
 * höchstens einen zusätzlichen Request pro Minute (staleTime dort).
 *
 * `excludePlayerId` beim Bieten im OfferModal übergeben — ein erneutes
 * Gebot auf denselben Spieler ist ein Upsert, siehe sumOpenOffers().
 */
export function useBudgetLimit(excludePlayerId?: string): BudgetLimit | null {
  const leagueId = useLeagueId();
  const league = useCurrentLeague();
  const market = useMarket(leagueId);

  return useMemo(() => {
    if (!league) return null;
    const pendingOffers = sumOpenOffers(market.data?.players ?? [], excludePlayerId);
    return computeBudgetLimit({ budget: league.budget, teamValue: league.teamValue, pendingOffers });
  }, [league, market.data, excludePlayerId]);
}
