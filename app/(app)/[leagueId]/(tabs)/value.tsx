import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { MarketPlayer } from '@/api/kickbase';
import { OfferModal } from '@/components/OfferModal';
import { QueryState } from '@/components/QueryState';
import type { ValueRowPlayer } from '@/components/ValueRow';
import { ValueRow } from '@/components/ValueRow';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useCurrentLeague } from '@/leagues/useCurrentLeague';
import { useLineup, useMarket } from '@/queries/hooks';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Segment = 'squad' | 'market';
type SortKey = 'avg' | 'total';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'squad', label: 'Mein Kader' },
  { key: 'market', label: 'Transfermarkt' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'avg', label: 'Ø-Punkte/Mio' },
  { key: 'total', label: 'Gesamt-Punkte/Mio' },
];

export default function ValueScreen() {
  const leagueId = useLeagueId();
  const router = useRouter();
  const league = useCurrentLeague();
  const [segment, setSegment] = useState<Segment>('squad');
  const [sortKey, setSortKey] = useState<SortKey>('avg');
  const [offerTarget, setOfferTarget] = useState<MarketPlayer | null>(null);

  const lineup = useLineup(leagueId);
  const market = useMarket(leagueId, { enabled: segment === 'market' });

  const active = segment === 'squad' ? lineup : market;
  const rawPlayers: ValueRowPlayer[] = segment === 'squad' ? (lineup.data?.players ?? []) : (market.data ?? []);

  const sorted = useMemo(() => {
    const key = sortKey === 'avg' ? 'valueScoreAvg' : 'valueScoreTotal';
    return [...rawPlayers].sort((a, b) => b[key] - a[key]);
  }, [rawPlayers, sortKey]);

  function openPlayer(player: ValueRowPlayer) {
    router.push(`/${leagueId}/player/${player.id}`);
  }

  // Nur im Transfermarkt-Segment gesetzt — im Kader-Segment bleibt ValueRow
  // ohne Gebotslage/Bieten-Button (onBid === undefined). `sorted` enthält in
  // diesem Segment tatsächlich MarketPlayer-Objekte, nur strukturell als
  // ValueRowPlayer typisiert.
  const bidHandler = segment === 'market' ? (player: ValueRowPlayer) => setOfferTarget(player as MarketPlayer) : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.segmentBar}>
        {SEGMENTS.map((s) => (
          <Pressable
            key={s.key}
            style={[styles.segmentChip, segment === s.key && styles.segmentChipActive]}
            onPress={() => setSegment(s.key)}
          >
            <Text style={[styles.segmentText, segment === s.key && styles.segmentTextActive]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

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

      {!active.data ? (
        <QueryState query={active} label="Daten" />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={active.isRefetching} onRefresh={active.refetch} tintColor={colors.accent} />
          }
          renderItem={({ item }) => <ValueRow player={item} onPress={openPlayer} onBid={bidHandler} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Keine Spieler gefunden.</Text>
            </View>
          }
        />
      )}

      <OfferModal player={offerTarget} budget={league?.budget ?? null} onClose={() => setOfferTarget(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  segmentBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: 0,
  },
  segmentChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  segmentChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  segmentText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.accent,
    fontWeight: '600',
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
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 36 + spacing.sm,
  },
});
