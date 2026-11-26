import { useMemo } from 'react';
import type { MarketPlayer, SquadPlayer } from '@/api/kickbase';
import { useBudgetLimit } from '@/leagues/useBudgetLimit';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useCurrentLeague } from '@/leagues/useCurrentLeague';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useLineup, useMarket, useMatchdays } from '@/queries/hooks';
import {
  averageDifficulty, buildFixtureIndex, fixtureDifficulty, remainingFixtures,
  teamGoalRecord, teamStrength, type AverageDifficulty,
} from '@/utils/fixtureDifficulty';
import { msUntil } from '@/utils/format';
import { resolveMatchdayState } from '@/utils/matchday';
import { useExcludedFromSaleContext } from './ExcludedFromSaleContext';
import { useLeagueRulesContext } from './LeagueRulesContext';
import { useLineupDraftContext } from './LineupDraftContext';
import { useSharedOptimizerSettings } from './OptimizerSettingsContext';
import { useLineupOptimizer } from './useLineupOptimizer';
import { useReplacementAdvice } from './useReplacementAdvice';

/** Wie viele kommende Spieltage in die 'expectedPoints'-Metrik einfließen (siehe fixtureDifficulty.ts). */
const FIXTURE_LOOKAHEAD = 5;

/*
 * Stabile Leer-Listen als Modul-Konstanten. Ein `?? []` an der Aufrufstelle
 * erzeugt bei JEDEM Render eine neue Referenz und entwertet damit die
 * Memoisierung in useLineupOptimizer/useReplacementAdvice — bei der Kaufseite
 * ist das keine Kosmetik, dort hängt eine Optimierung pro Listing daran.
 */
const NO_SQUAD_PLAYERS: SquadPlayer[] = [];
const NO_MARKET_PLAYERS: MarketPlayer[] = [];

export function useTransferData() {
  const leagueId = useLeagueId();
  const competitionId = useCompetitionId();
  const lineupQuery = useLineup(leagueId);
  const { data } = lineupQuery;
  const matchdaysQuery = useMatchdays(competitionId);
  // Dieselbe Query, die useBudgetLimit unten ohnehin mountet — React Query
  // dedupliziert über den Key, kein zusätzlicher Request beim Pull.
  const marketQuery = useMarket(leagueId);
  // Budget lebt in LeagueSummary (`/v4/leagues/selection`), NICHT in
  // LineupData — `lineup/overview.b` ist trotz Namens keine Kontostandsgröße,
  // siehe toLineupData() in mappers.ts.
  const league = useCurrentLeague();
  const budgetLimit = useBudgetLimit();
  const { rules, loaded: rulesLoaded } = useLeagueRulesContext();
  const { excludedIds, toggleExcluded } = useExcludedFromSaleContext();
  const { draftIds } = useLineupDraftContext();

  // Spielplan der Competition ist die verlässliche Quelle für "welcher
  // Spieltag läuft/ist offen" — mdln/lis auf lineup/overview hängen
  // erfahrungsgemäß hinterher (siehe utils/matchday.ts). Fällt die Query
  // aus, degradieren wir auf die alte lis-basierte Deadline.
  const matchdayState = useMemo(() => {
    if (!matchdaysQuery.data) return null;
    return resolveMatchdayState(matchdaysQuery.data, Date.now());
  }, [matchdaysQuery.data]);

  // Gegner-Härte je Verein für die 'expectedPoints'-Metrik (siehe
  // src/utils/fixtureDifficulty.ts), gemittelt über die nächsten
  // FIXTURE_LOOKAHEAD Spieltage ab dem nächsten noch offenen. Ohne Spielplan
  // (Query lädt noch) bleibt die Map undefined — useLineupOptimizer
  // degradiert dann sauber auf reine Ø-Punkte.
  const fixtureDifficultyByTeam = useMemo(() => {
    if (!matchdaysQuery.data) return undefined;
    const fromDay = matchdayState?.open?.day ?? matchdaysQuery.data.currentDay ?? 1;
    const index = buildFixtureIndex(matchdaysQuery.data);
    const strengths = teamStrength(teamGoalRecord(matchdaysQuery.data));
    const map = new Map<string, AverageDifficulty>();
    for (const teamId of index.keys()) {
      const upcoming = remainingFixtures(teamId, index, fromDay, FIXTURE_LOOKAHEAD);
      map.set(teamId, averageDifficulty(fixtureDifficulty(upcoming, strengths)));
    }
    return map;
  }, [matchdaysQuery.data, matchdayState]);

  const optimizerSettings = useSharedOptimizerSettings();
  const optimizer = useLineupOptimizer(
    data?.players ?? NO_SQUAD_PLAYERS,
    draftIds,
    budgetLimit?.deficit ?? 0,
    rules,
    fixtureDifficultyByTeam,
    excludedIds,
    optimizerSettings,
  );

  // Die Kaufseite. `optimizer.constraints` und `optimizer.metric` bewusst
  // durchgereicht statt hier neu abgeleitet: der Zugewinn eines Zukaufs wird
  // gegen die ANGEZEIGTE Elf gemessen, also muss er unter denselben Schranken
  // rechnen — inklusive eines Session-„Ignorieren" (siehe useReplacementAdvice).
  const marketPlayers = marketQuery.data?.players ?? NO_MARKET_PLAYERS;
  // Vergleiche verwenden dieselbe Grundlage auf BEIDEN Seiten, auch wenn
  // z. B. der Kader schon vollständig geladen ist und der Markt noch nicht.
  const comparisonUsesKickbase = lineupQuery.pointAverageState?.basis === 'kickbase' ||
    marketQuery.pointAverageState?.basis === 'kickbase';
  const comparisonSquad = comparisonUsesKickbase
    ? lineupQuery.rawData?.players ?? data?.players ?? NO_SQUAD_PLAYERS
    : data?.players ?? NO_SQUAD_PLAYERS;
  const comparisonMarket = comparisonUsesKickbase
    ? marketQuery.rawData?.players ?? marketPlayers : marketPlayers;
  const replacement = useReplacementAdvice(
    comparisonSquad,
    comparisonMarket,
    optimizer.metric,
    optimizer.constraints,
    budgetLimit,
    fixtureDifficultyByTeam,
  );

  const fallbackDeadlineMs = data ? msUntil(data.lineupDeadline) : null;
  const openDeadlineMs = matchdayState
    ? matchdayState.open
      ? msUntil(matchdayState.open.deadline)
      : null
    : fallbackDeadlineMs;
  const hasOpenMatchday = matchdayState
    ? matchdayState.open !== null
    : openDeadlineMs !== null && openDeadlineMs > 0;
  const displayMatchday =
    matchdayState?.running?.day ?? matchdayState?.open?.day ?? data?.matchday ?? null;

  return {
    leagueId, competitionId, lineupQuery, data, matchdaysQuery, marketQuery, league, budgetLimit,
    rules, rulesLoaded, toggleExcluded, matchdayState, fixtureDifficultyByTeam, optimizer,
    comparisonUsesKickbase, comparisonSquad, comparisonMarket, replacement,
    openDeadlineMs, hasOpenMatchday, displayMatchday,
  };
}
