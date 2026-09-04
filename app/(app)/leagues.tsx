import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LeagueSummary } from '@/api/kickbase';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { getLastLeagueId, setLastLeagueId } from '@/leagues/lastLeague';
import { useMarkInteractive } from '@/observe/useMarkInteractive';
import { useLeagues } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatCurrency } from '@/utils/format';

export default function LeaguesScreen() {
  const leaguesQuery = useLeagues();
  const { data: leagues } = leaguesQuery;
  const refresh = useRefresh(leaguesQuery);
  const [lastLeagueId, setLastLeagueIdState] = useState<string | null>(null);

  // Bei Fokus statt nur einmal beim Mount lesen — sonst zeigt das Badge nach
  // einem Liga-Wechsel im Header-Switcher (LeagueSwitcher) und Rückkehr
  // hierher noch die vorherige Liga als "zuletzt genutzt" an.
  useFocusEffect(
    useCallback(() => {
      getLastLeagueId().then(setLastLeagueIdState);
    }, []),
  );

  useMarkInteractive(!!leagues);

  async function handleSelect(league: LeagueSummary) {
    await setLastLeagueId(league.id);
    router.push(`/${league.id}/lineup`);
  }

  if (!leagues) {
    return <QueryState query={leaguesQuery} label="Ligen" refresh={refresh} />;
  }

  return (
    <Refreshable {...refresh}>
      {(p) => (
        <FlatList
          {...p}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={leagues}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Keine Ligen gefunden.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => handleSelect(item)}>
              <View style={styles.cardHeader}>
                <Text style={styles.leagueName}>{item.name}</Text>
                {item.id === lastLeagueId && (
                  <View style={styles.lastBadge}>
                    <Text style={styles.lastBadgeText}>Zuletzt genutzt</Text>
                  </View>
                )}
              </View>
              <View style={styles.statsRow}>
                <Text style={styles.statText}>Teamwert {formatCurrency(item.teamValue)}</Text>
                {item.memberCount !== null && (
                  <Text style={styles.statText}>{item.memberCount} Manager</Text>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </Refreshable>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leagueName: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  lastBadge: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  lastBadgeText: {
    ...typography.small,
    color: colors.accent,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  statText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
