import { useCurrentLeague } from './useCurrentLeague';

/**
 * Die Competition-ID (z.B. "1" = Bundesliga) der aktuellen Liga — nötig, um
 * Mannschaftsnamen über `/v4/competitions/{id}/table` aufzulösen.
 */
export function useCompetitionId(): string | null {
  return useCurrentLeague()?.competitionId ?? null;
}
