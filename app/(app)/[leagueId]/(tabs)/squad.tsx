import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import type { Position, SquadPlayer } from '@/api/kickbase';
import { PlayerFilterBar } from '@/components/PlayerFilterBar';
import { PlayerRow } from '@/components/PlayerRow';
import { PlayerRowSeparator } from '@/components/PlayerRowFrame';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { SortChips } from '@/components/SortChips';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useCompetitionTeams, useLineup, usePlaytimes } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, positionLabels, spacing, typography } from '@/theme/tokens';
import { metricForSort, metricLabels, metricNeedsPlaytime, metricValue, type PlayerSortKey } from '@/utils/playerMetric';
import type { PlayerFilterCriteria } from '@/utils/playerFilter';
import { EMPTY_PLAYER_FILTER, filterPlayers } from '@/utils/playerFilter';

// Modul-Konstante statt inline `[]`: usePlaytimes/useQueries brauchen eine
// referenziell stabile ID-Liste, sonst baut useQueries sie bei jedem Render neu.
const NO_PLAYTIME_IDS: string[] = [];

// Trenner vor der ersten Wert-Kennzahl: die sortiert global (wer hat das
// schlechteste €/Punkt-Verhältnis) statt nach Position zu gruppieren wie die
// vier Chips davor — der Trenner macht die gemischte Dimension erkennbar.
const SORT_OPTIONS: { key: PlayerSortKey; label: string; dividerBefore?: boolean }[] = [
  { key: 'position', label: 'Position' },
  { key: 'marketValue', label: 'Marktwert' },
  { key: 'totalPoints', label: 'Punkte' },
  { key: 'avgPoints', label: 'Ø Punkte' },
  { key: 'avgPerMillion', label: metricLabels.avgPerMillion.chip, dividerBefore: true },
  { key: 'totalPerMillion', label: metricLabels.totalPerMillion.chip },
  { key: 'pointsPerMinute', label: metricLabels.pointsPerMinute.chip },
];

const POSITION_ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

export default function SquadScreen() {
  const leagueId = useLeagueId();
  const router = useRouter();
  const lineupQuery = useLineup(leagueId);
  const { data } = lineupQuery;
  const [sortKey, setSortKey] = useState<PlayerSortKey>('position');
  const [filter, setFilter] = useState<PlayerFilterCriteria>(EMPTY_PLAYER_FILTER);
  const competitionId = useCompetitionId();
  const teamsQuery = useCompetitionTeams(competitionId);

  // Die Spielminuten (ein Request PRO SPIELER) nur laden, wenn die aktive
  // Sortierung sie tatsächlich braucht — aus der UNGEFILTERTEN Liste, sonst
  // würde jeder Filter-Tap sie neu anfragen.
  const needsPlaytime = metricNeedsPlaytime(metricForSort(sortKey, 'avgPoints'));
  const playtimeIds = useMemo(
    () => (needsPlaytime ? (data?.players ?? []).map((p) => p.id) : NO_PLAYTIME_IDS),
    [data, needsPlaytime],
  );
  const playtimeState = usePlaytimes(leagueId, playtimeIds);
  const { playtimes } = playtimeState;

  const refresh = useRefresh(lineupQuery, playtimeState);

  const filteredPlayers = useMemo(
    () => (data ? filterPlayers(data.players, filter) : []),
    [data, filter],
  );

  const statMetric = metricForSort(sortKey, 'avgPoints');

  const sections = useMemo(() => {
    if (!data) return [];
    if (sortKey !== 'position') {
      const sorted = [...filteredPlayers].sort(
        (a, b) => metricValue(b, statMetric, playtimes.get(b.id)) - metricValue(a, statMetric, playtimes.get(a.id)),
      );
      return [{ title: '', data: sorted }];
    }
    // Filter greift VOR der Section-Bildung — sonst blieben leere Positions-
    // Überschriften stehen, sobald ein Filter eine Position komplett wegfiltert.
    return POSITION_ORDER.map((position) => ({
      title: positionLabels[position],
      data: filteredPlayers
        .filter((p) => p.position === position)
        .sort((a, b) => b.marketValue - a.marketValue),
    })).filter((section) => section.data.length > 0);
  }, [data, sortKey, filteredPlayers, statMetric, playtimes]);

  function openPlayer(player: SquadPlayer) {
    router.push(`/${leagueId}/player/${player.id}`);
  }

  if (!data) {
    return <QueryState query={lineupQuery} label="Kader" refresh={refresh} />;
  }

  return (
    <View style={styles.container}>
      <PlayerFilterBar criteria={filter} onChange={setFilter} teams={teamsQuery.data} />

      <SortChips options={SORT_OPTIONS} value={sortKey} onChange={setSortKey} />

      {/* Ohne diesen Hinweis wirkt das Nachsortieren während des Ladens wie ein Fehler. */}
      {playtimeState.pending > 0 && (
        <Text style={styles.playtimeHint}>
          Spielzeiten … {playtimeState.total - playtimeState.pending}/{playtimeState.total}
        </Text>
      )}

      <Refreshable {...refresh}>
        {(p) => (
          <SectionList
            {...p}
            sections={sections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled
            renderSectionHeader={({ section }) =>
              section.title ? (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{section.title}</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <PlayerRow player={item} metric={statMetric} playtime={playtimes.get(item.id)} onPress={openPlayer} />
            )}
            ItemSeparatorComponent={PlayerRowSeparator}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Kein Spieler passt zum Filter.</Text>
              </View>
            }
          />
        )}
      </Refreshable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  sectionHeaderText: {
    ...typography.small,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playtimeHint: {
    ...typography.small,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
});
