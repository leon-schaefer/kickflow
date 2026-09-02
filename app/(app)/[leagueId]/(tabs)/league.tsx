import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LeagueRankingEntry } from '@/api/kickbase';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { useAuth } from '@/auth/AuthProvider';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useLeagueRanking } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatCurrency, formatPoints } from '@/utils/format';

/**
 * Liga-Tabelle über `/v4/leagues/{id}/ranking` — die größte bisher fehlende
 * Säule gegenüber Kickly/Base XI (siehe Plan „Liga-Tab"). Zeigt Platzierung,
 * Punkte und Teamwert jedes Managers; ein Antippen öffnet dessen Startelf
 * (manager/[managerId].tsx). Season-Ansicht only — ein Spieltags-Umschalter
 * (dayNumber) ist bewusst nicht Teil dieser ersten Version.
 */
export default function LeagueScreen() {
  const leagueId = useLeagueId();
  const router = useRouter();
  const { userId } = useAuth();
  const rankingQuery = useLeagueRanking(leagueId);
  const { data } = rankingQuery;
  const refresh = useRefresh(rankingQuery);

  const rows = useMemo(() => {
    if (!data) return [];
    return [...data.entries].sort((a, b) => a.seasonPlace - b.seasonPlace);
  }, [data]);

  if (!data) {
    return <QueryState query={rankingQuery} label="Liga-Tabelle" refresh={refresh} />;
  }

  function openManager(entry: LeagueRankingEntry) {
    router.push(`/${leagueId}/manager/${entry.userId}`);
  }

  return (
    <View style={styles.container}>
      <Refreshable {...refresh}>
        {(p) => (
          <FlatList
            {...p}
            data={rows}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => (
              <ManagerRow entry={item} isOwn={item.userId === userId} onPress={openManager} />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Keine Liga-Tabelle gefunden.</Text>
              </View>
            }
          />
        )}
      </Refreshable>
    </View>
  );
}

function ManagerRow({
  entry,
  isOwn,
  onPress,
}: {
  entry: LeagueRankingEntry;
  isOwn: boolean;
  onPress: (entry: LeagueRankingEntry) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(entry)}
      style={({ pressed }) => [styles.row, isOwn && styles.rowOwn, pressed && styles.pressed]}
    >
      <Text style={styles.place}>{entry.seasonPlace || '—'}</Text>

      {entry.userImageUrl ? (
        <Image source={{ uri: entry.userImageUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]} />
      )}

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.userName}
          </Text>
          {entry.isAdmin && <Text style={styles.adminTag}>Admin</Text>}
        </View>
        <Text style={styles.subText}>
          {entry.hasLineupSet ? 'Aufstellung steht' : 'Aufstellung offen'} · {formatCurrency(entry.teamValue)}
        </Text>
      </View>

      <View style={styles.scores}>
        <Text style={styles.seasonPoints}>{formatPoints(entry.seasonPoints)}</Text>
        <Text style={styles.matchdayPoints}>ST {formatPoints(entry.matchdayPoints)}</Text>
      </View>
    </Pressable>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  rowOwn: {
    backgroundColor: colors.accentMuted,
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
  place: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
  },
  avatarFallback: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  adminTag: {
    ...typography.small,
    color: colors.accent,
    fontWeight: '600',
  },
  subText: {
    ...typography.small,
    color: colors.textMuted,
  },
  scores: {
    alignItems: 'flex-end',
    gap: 2,
  },
  seasonPoints: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  matchdayPoints: {
    ...typography.small,
    color: colors.textSecondary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 24 + spacing.sm + 36 + spacing.sm,
  },
});
