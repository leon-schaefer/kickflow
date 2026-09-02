import { useMemo } from 'react';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useMarket, useMatchdays } from '@/queries/hooks';
import { resolveMatchdayState } from '@/utils/matchday';
import type { DeadlineInfo, OpenBid } from './scheduler';
import { useNotificationPreferences } from './useNotificationPreferences';
import { useNotificationSync } from './useNotificationSync';

/**
 * Verbindet useNotificationSync (scheduler.ts) mit den Live-Daten der
 * aktuellen Liga — Deadline aus dem Spielplan, offene Gebote aus dem
 * Transfermarkt. Gemountet in [leagueId]/_layout.tsx, läuft also unabhängig
 * davon, welcher Tab gerade offen ist. `useMatchdays`/`useMarket` sind
 * dieselben Queries, die lineup.tsx/value.tsx ohnehin laden (useBudgetLimit
 * hält `useMarket` bereits unconditional) — kein zusätzlicher Request.
 */
export function useLeagueNotifications(): void {
  const leagueId = useLeagueId();
  const competitionId = useCompetitionId();
  const matchdaysQuery = useMatchdays(competitionId);
  const marketQuery = useMarket(leagueId);
  const { preferences } = useNotificationPreferences();

  const deadline = useMemo((): DeadlineInfo | null => {
    if (!matchdaysQuery.data) return null;
    const state = resolveMatchdayState(matchdaysQuery.data, Date.now());
    return state.open ? { day: state.open.day, deadlineIso: state.open.deadline } : null;
  }, [matchdaysQuery.data]);

  const openBids = useMemo((): OpenBid[] => {
    if (!marketQuery.data) return [];
    return marketQuery.data.players
      .filter((player) => player.ownOfferPrice != null && player.expiresInSeconds != null)
      .map((player) => ({
        playerId: player.id,
        playerName: player.name,
        expiresInSeconds: player.expiresInSeconds!,
      }));
  }, [marketQuery.data]);

  useNotificationSync({ deadline, openBids, preferences }, matchdaysQuery.dataUpdatedAt, marketQuery.dataUpdatedAt);
}
