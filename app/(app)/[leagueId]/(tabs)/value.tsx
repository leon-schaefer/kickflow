import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MarketPlayer } from '@/api/kickbase';
import { BudgetBar } from '@/components/BudgetBar';
import { OfferModal } from '@/components/OfferModal';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import type { ValueRowPlayer } from '@/components/ValueRow';
import { ValueRow } from '@/components/ValueRow';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useBudgetLimit } from '@/leagues/useBudgetLimit';
import { useLeagues, useLineup, useMarket, usePlaytimes } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { pointsPerMinute } from '@/utils/playtime';

type Segment = 'squad' | 'market';
type SortKey = 'avg' | 'total' | 'perMinute';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'squad', label: 'Mein Kader' },
  { key: 'market', label: 'Transfermarkt' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'avg', label: 'Ø-Punkte/Mio' },
  { key: 'total', label: 'Gesamt-Punkte/Mio' },
  { key: 'perMinute', label: 'Punkte/Min' },
];

export default function ValueScreen() {
  const leagueId = useLeagueId();
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('squad');
  const [sortKey, setSortKey] = useState<SortKey>('avg');
  const [offerTarget, setOfferTarget] = useState<MarketPlayer | null>(null);
  const limit = useBudgetLimit();

  const lineup = useLineup(leagueId);
  const market = useMarket(leagueId, { enabled: segment === 'market' });
  const leaguesQuery = useLeagues();

  const active = segment === 'squad' ? lineup : market;
  const rawPlayers: ValueRowPlayer[] = segment === 'squad' ? (lineup.data?.players ?? []) : (market.data ?? []);

  // Spielminuten gibt es nur pro Spieler (siehe usePlaytimes) — stabile
  // ID-Liste, damit useQueries seine Query-Liste nicht bei jedem Render neu baut.
  const playerIds = useMemo(() => rawPlayers.map((player) => player.id), [rawPlayers]);
  const playtimeState = usePlaytimes(leagueId, playerIds);
  const { playtimes } = playtimeState;

  // BudgetBar (Marktwert-Segment) hängt an useBudgetLimit -> leaguesQuery
  // gehört mit in den Pull, auch wenn dieser Screen sie sonst nicht anzeigt.
  const refresh = useRefresh(lineup, market, leaguesQuery, playtimeState);

  const sorted = useMemo(() => {
    if (sortKey === 'perMinute') {
      // Spieler ohne geladene oder ohne vorhandene Spielzeit zählen als 0 und
      // landen damit unten — die Liste sortiert sich beim Nachladen nach.
      const perMinute = (player: ValueRowPlayer) => {
        const playtime = playtimes.get(player.id);
        return playtime ? pointsPerMinute(playtime.points, playtime.minutes) : 0;
      };
      return [...rawPlayers].sort((a, b) => perMinute(b) - perMinute(a));
    }
    const key = sortKey === 'avg' ? 'valueScoreAvg' : 'valueScoreTotal';
    return [...rawPlayers].sort((a, b) => b[key] - a[key]);
  }, [rawPlayers, sortKey, playtimes]);

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

      {/* Ohne diesen Hinweis wirkt das Nachsortieren während des Ladens wie ein Fehler. */}
      {playtimeState.pending > 0 && (
        <Text style={styles.playtimeHint}>
          Spielzeiten … {playtimeState.total - playtimeState.pending}/{playtimeState.total}
        </Text>
      )}

      {segment === 'market' && limit && <BudgetBar limit={limit} />}

      {!active.data ? (
        <QueryState query={active} label="Daten" refresh={refresh} />
      ) : (
        <Refreshable {...refresh}>
          {(p) => (
            <FlatList
              {...p}
              data={sorted}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ValueRow
                  player={item}
                  playtime={playtimes.get(item.id)}
                  onPress={openPlayer}
                  onBid={bidHandler}
                />
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.emptyText}>Keine Spieler gefunden.</Text>
                </View>
              }
            />
          )}
        </Refreshable>
      )}

      <OfferModal player={offerTarget} onClose={() => setOfferTarget(null)} />
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
    // Drei Chips passen auf schmalen Geräten nicht mehr in eine Zeile.
    flexWrap: 'wrap',
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
  playtimeHint: {
    ...typography.small,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 36 + spacing.sm,
  },
});
