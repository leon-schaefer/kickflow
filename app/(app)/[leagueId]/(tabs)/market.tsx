import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MarketPlayer } from '@/api/kickbase';
import { BudgetBar } from '@/components/BudgetBar';
import { OfferModal } from '@/components/OfferModal';
import { PlayerFilterBar } from '@/components/PlayerFilterBar';
import { MarketRow } from '@/components/MarketRow';
import { PlayerRowSeparator } from '@/components/PlayerRowFrame';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { SortChips, SortChipsDivider } from '@/components/SortChips';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useBudgetLimit } from '@/leagues/useBudgetLimit';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useCompetitionTeams, useLeagues, useMarket, usePlaytimes } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatCountdown, msUntil } from '@/utils/format';
import { filterOwnBids, sortByExpiry } from '@/utils/marketList';
import { metricForSort, metricLabels, metricNeedsPlaytime, metricValue, type PlayerSortKey } from '@/utils/playerMetric';
import type { PlayerFilterCriteria } from '@/utils/playerFilter';
import { EMPTY_PLAYER_FILTER, filterPlayers, isPlayerFilterActive } from '@/utils/playerFilter';

// Modul-Konstante statt inline `[]`: usePlaytimes/useQueries brauchen eine
// referenziell stabile ID-Liste, sonst baut useQueries sie bei jedem Render neu.
const NO_PLAYTIME_IDS: string[] = [];

const SORT_OPTIONS: { key: PlayerSortKey; label: string }[] = [
  { key: 'avgPerMillion', label: metricLabels.avgPerMillion.chip },
  { key: 'totalPerMillion', label: metricLabels.totalPerMillion.chip },
  { key: 'pointsPerMinute', label: metricLabels.pointsPerMinute.chip },
  { key: 'expiry', label: 'Ablauf' },
];

export default function MarketScreen() {
  const leagueId = useLeagueId();
  const router = useRouter();
  const [sortKey, setSortKey] = useState<PlayerSortKey>('avgPerMillion');
  const [onlyOwnBids, setOnlyOwnBids] = useState(false);
  const [offerTarget, setOfferTarget] = useState<MarketPlayer | null>(null);
  const [filter, setFilter] = useState<PlayerFilterCriteria>(EMPTY_PLAYER_FILTER);
  const limit = useBudgetLimit();
  const competitionId = useCompetitionId();
  const teamsQuery = useCompetitionTeams(competitionId);

  const market = useMarket(leagueId);
  const leaguesQuery = useLeagues();
  const rawPlayers: MarketPlayer[] = market.data?.players ?? [];

  // Countdown-Anzeige lebendig halten, ohne dafür zu pollen (kein Netzwerk-
  // Request) — gleicher Trick wie der Deadline-Countdown auf lineup.tsx.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const marketValueUpdateMs = market.data ? msUntil(market.data.marketValueUpdateAt) : null;

  // Die Spielminuten (ein Request PRO SPIELER) nur laden, wenn die aktive
  // Sortierung sie tatsächlich braucht — aus der UNGEFILTERTEN Liste, sonst
  // würde jeder Filter-Tap sie neu anfragen.
  const needsPlaytime = metricNeedsPlaytime(metricForSort(sortKey, 'avgPerMillion'));
  const playerIds = useMemo(
    () => (needsPlaytime ? rawPlayers.map((player) => player.id) : NO_PLAYTIME_IDS),
    [rawPlayers, needsPlaytime],
  );
  const playtimeState = usePlaytimes(leagueId, playerIds);
  const { playtimes } = playtimeState;

  // BudgetBar hängt an useBudgetLimit -> leaguesQuery gehört mit in den Pull,
  // auch wenn dieser Screen ihre Daten sonst nicht direkt anzeigt.
  const refresh = useRefresh(market, leaguesQuery, playtimeState);

  const statMetric = metricForSort(sortKey, 'avgPerMillion');

  const sorted = useMemo(() => {
    const filtered = filterPlayers(rawPlayers, filter);
    const base = onlyOwnBids ? filterOwnBids(filtered) : filtered;
    if (sortKey === 'expiry') return sortByExpiry(base);
    return [...base].sort(
      (a, b) => metricValue(b, statMetric, playtimes.get(b.id)) - metricValue(a, statMetric, playtimes.get(a.id)),
    );
  }, [rawPlayers, sortKey, statMetric, playtimes, onlyOwnBids, filter]);

  function openPlayer(player: MarketPlayer) {
    router.push(`/${leagueId}/player/${player.id}`);
  }

  return (
    <View style={styles.container}>
      <PlayerFilterBar criteria={filter} onChange={setFilter} teams={teamsQuery.data} />

      <SortChips
        options={SORT_OPTIONS}
        value={sortKey}
        onChange={setSortKey}
        leading={
          <>
            <Pressable
              style={[styles.sortChip, onlyOwnBids && styles.sortChipActive]}
              onPress={() => setOnlyOwnBids((value) => !value)}
            >
              <Text style={[styles.sortChipText, onlyOwnBids && styles.sortChipTextActive]}>
                Nur meine Gebote
              </Text>
            </Pressable>
            <SortChipsDivider />
          </>
        }
      />

      {marketValueUpdateMs != null && marketValueUpdateMs > 0 && (
        <Text style={styles.updateHint}>Nächstes Marktwert-Update in {formatCountdown(marketValueUpdateMs)}</Text>
      )}

      {/* Ohne diesen Hinweis wirkt das Nachsortieren während des Ladens wie ein Fehler. */}
      {playtimeState.pending > 0 && (
        <Text style={styles.playtimeHint}>
          Spielzeiten … {playtimeState.total - playtimeState.pending}/{playtimeState.total}
        </Text>
      )}

      {limit && <BudgetBar limit={limit} />}

      {!market.data ? (
        <QueryState query={market} label="Transfermarkt" refresh={refresh} />
      ) : (
        <Refreshable {...refresh}>
          {(p) => (
            <FlatList
              {...p}
              data={sorted}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <MarketRow
                  player={item}
                  playtime={playtimes.get(item.id)}
                  metric={statMetric}
                  onPress={openPlayer}
                  onBid={setOfferTarget}
                />
              )}
              ItemSeparatorComponent={PlayerRowSeparator}
              ListEmptyComponent={
                <View style={styles.center}>
                  {/* Eigener Text bei aktivem Filter — „Keine Spieler gefunden“
                      würde hier wie ein Ladefehler wirken. */}
                  <Text style={styles.emptyText}>
                    {onlyOwnBids
                      ? 'Du hast auf keinen Spieler geboten.'
                      : isPlayerFilterActive(filter)
                        ? 'Kein Spieler passt zum Filter.'
                        : 'Keine Spieler gefunden.'}
                  </Text>
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
  updateHint: {
    ...typography.small,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
});
