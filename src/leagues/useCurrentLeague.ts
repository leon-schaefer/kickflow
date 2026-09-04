import type { LeagueSummary } from '@/api/kickbase';
import { useLeagues } from '@/queries/hooks';
import { useLeagueId } from './LeagueIdContext';

/**
 * Das `LeagueSummary`-Objekt der aktuellen Liga. `useLeagues()` ist bereits
 * vom Liga-Picker gecacht, hier also kein zusätzlicher Request.
 */
export function useCurrentLeague(): LeagueSummary | null {
  const leagueId = useLeagueId();
  const { data: leagues } = useLeagues();
  return leagues?.find((league) => league.id === leagueId) ?? null;
}
