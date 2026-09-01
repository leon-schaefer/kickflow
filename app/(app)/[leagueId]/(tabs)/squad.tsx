import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import type { Position, SquadPlayer } from '@/api/kickbase';
import { PlayerRow } from '@/components/PlayerRow';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useLineup } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, positionLabels, radius, spacing, typography } from '@/theme/tokens';

type SortKey = 'position' | 'value' | 'points' | 'avg';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'position', label: 'Position' },
  { key: 'value', label: 'Marktwert' },
  { key: 'points', label: 'Punkte' },
  { key: 'avg', label: 'Ø Punkte' },
];

const POSITION_ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

export default function SquadScreen() {
  const leagueId = useLeagueId();
  const router = useRouter();
  const lineupQuery = useLineup(leagueId);
  const { data } = lineupQuery;
  const refresh = useRefresh(lineupQuery);
  const [sortKey, setSortKey] = useState<SortKey>('position');

  const sections = useMemo(() => {
    if (!data) return [];
    if (sortKey !== 'position') {
      const comparator = sortComparator(sortKey);
      return [{ title: '', data: [...data.players].sort(comparator) }];
    }
    return POSITION_ORDER.map((position) => ({
      title: positionLabels[position],
      data: data.players
        .filter((p) => p.position === position)
        .sort((a, b) => b.marketValue - a.marketValue),
    })).filter((section) => section.data.length > 0);
  }, [data, sortKey]);

  function openPlayer(player: SquadPlayer) {
    router.push(`/${leagueId}/player/${player.id}`);
  }

  if (!data) {
    return <QueryState query={lineupQuery} label="Kader" refresh={refresh} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.sortBar}>
        {SORT_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            style={[styles.sortChip, sortKey === option.key && styles.sortChipActive]}
            onPress={() => setSortKey(option.key)}
          >
            <Text style={[styles.sortChipText, sortKey === option.key && styles.sortChipTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

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
            renderItem={({ item }) => <PlayerRow player={item} onPress={openPlayer} />}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </Refreshable>
    </View>
  );
}

function sortComparator(key: SortKey) {
  return (a: SquadPlayer, b: SquadPlayer) => {
    switch (key) {
      case 'value':
        return b.marketValue - a.marketValue;
      case 'points':
        return b.totalPoints - a.totalPoints;
      case 'avg':
        return b.averagePoints - a.averagePoints;
      default:
        return 0;
    }
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sortBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  sortChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sortChipTextActive: {
    color: colors.accent,
    fontWeight: '600',
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
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 36 + spacing.sm,
  },
});
