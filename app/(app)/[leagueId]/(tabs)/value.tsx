import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { filterOwnBids, sortByExpiry } from '@/utils/marketList';
import { pointsPerMinute } from '@/utils/playtime';

type Segment = 'squad' | 'market';
type SortKey = 'avg' | 'total' | 'perMinute' | 'expiry';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'squad', label: 'Mein Kader' },
  { key: 'market', label: 'Transfermarkt' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'avg', label: 'Ø-Punkte/Mio' },
  { key: 'total', label: 'Gesamt-Punkte/Mio' },
  { key: 'perMinute', label: 'Punkte/Min' },
];

/** Nach Ablauf sortieren geht nur im Markt — der Kader kennt keine Restlaufzeit. */
const MARKET_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  ...SORT_OPTIONS,
  { key: 'expiry', label: 'Ablauf' },
];

export default function ValueScreen() {
  const leagueId = useLeagueId();
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('squad');
  const [sortKey, setSortKey] = useState<SortKey>('avg');
  const [onlyOwnBids, setOnlyOwnBids] = useState(false);
  const [offerTarget, setOfferTarget] = useState<MarketPlayer | null>(null);
  const limit = useBudgetLimit();

  const lineup = useLineup(leagueId);
  const market = useMarket(leagueId, { enabled: segment === 'market' });
  const leaguesQuery = useLeagues();

  const active = segment === 'squad' ? lineup : market;
  const rawPlayers: ValueRowPlayer[] = segment === 'squad' ? (lineup.data?.players ?? []) : (market.data ?? []);

  // Spielminuten gibt es nur pro Spieler (siehe usePlaytimes) — stabile
  // ID-Liste, damit useQueries seine Query-Liste nicht bei jedem Render neu baut.
  // Bewusst aus der UNGEFILTERTEN Liste: sonst würde jedes Umschalten des
  // Gebots-Filters die Spielzeiten neu anfragen.
  const playerIds = useMemo(() => rawPlayers.map((player) => player.id), [rawPlayers]);
  const playtimeState = usePlaytimes(leagueId, playerIds);
  const { playtimes } = playtimeState;

  // BudgetBar (Marktwert-Segment) hängt an useBudgetLimit -> leaguesQuery
  // gehört mit in den Pull, auch wenn dieser Screen sie sonst nicht anzeigt.
  const refresh = useRefresh(lineup, market, leaguesQuery, playtimeState);

  const isMarket = segment === 'market';
  const ownBidsOnly = isMarket && onlyOwnBids;

  const sorted = useMemo(() => {
    const base = ownBidsOnly ? filterOwnBids(rawPlayers) : rawPlayers;
    if (sortKey === 'expiry') {
      return sortByExpiry(base);
    }
    if (sortKey === 'perMinute') {
      // Spieler ohne geladene oder ohne vorhandene Spielzeit zählen als 0 und
      // landen damit unten — die Liste sortiert sich beim Nachladen nach.
      const perMinute = (player: ValueRowPlayer) => {
        const playtime = playtimes.get(player.id);
        return playtime ? pointsPerMinute(playtime.points, playtime.minutes) : 0;
      };
      return [...base].sort((a, b) => perMinute(b) - perMinute(a));
    }
    const key = sortKey === 'avg' ? 'valueScoreAvg' : 'valueScoreTotal';
    return [...base].sort((a, b) => b[key] - a[key]);
  }, [rawPlayers, sortKey, playtimes, ownBidsOnly]);

  function openPlayer(player: ValueRowPlayer) {
    router.push(`/${leagueId}/player/${player.id}`);
  }

  // Die Ablauf-Sortierung gibt es nur im Markt — beim Wechsel in den Kader
  // würde sie sonst auf einem Feld sortieren, das SquadPlayer nicht hat.
  function selectSegment(next: Segment) {
    setSegment(next);
    if (next !== 'market' && sortKey === 'expiry') setSortKey('avg');
  }

  // Nur im Transfermarkt-Segment gesetzt — im Kader-Segment bleibt ValueRow
  // ohne Gebotslage/Bieten-Button (onBid === undefined). `sorted` enthält in
  // diesem Segment tatsächlich MarketPlayer-Objekte, nur strukturell als
  // ValueRowPlayer typisiert.
  const bidHandler = isMarket ? (player: ValueRowPlayer) => setOfferTarget(player as MarketPlayer) : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.segmentBar}>
        {SEGMENTS.map((s) => (
          <Pressable
            key={s.key}
            style={[styles.segmentChip, segment === s.key && styles.segmentChipActive]}
            onPress={() => selectSegment(s.key)}
          >
            <Text style={[styles.segmentText, segment === s.key && styles.segmentTextActive]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {isMarket && (
          <>
            <Pressable
              style={[styles.sortChip, onlyOwnBids && styles.sortChipActive]}
              onPress={() => setOnlyOwnBids((value) => !value)}
            >
              <Text style={[styles.sortChipText, onlyOwnBids && styles.sortChipTextActive]}>
                Nur meine Gebote
              </Text>
            </Pressable>
            <View style={styles.chipDivider} />
          </>
        )}
        {(isMarket ? MARKET_SORT_OPTIONS : SORT_OPTIONS).map((option) => (
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
      </ScrollView>

      {/* Ohne diesen Hinweis wirkt das Nachsortieren während des Ladens wie ein Fehler. */}
      {playtimeState.pending > 0 && (
        <Text style={styles.playtimeHint}>
          Spielzeiten … {playtimeState.total - playtimeState.pending}/{playtimeState.total}
        </Text>
      )}

      {isMarket && limit && <BudgetBar limit={limit} />}

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
                  {/* Eigener Text bei aktivem Filter — „Keine Spieler gefunden“
                      würde hier wie ein Ladefehler wirken. */}
                  <Text style={styles.emptyText}>
                    {ownBidsOnly ? 'Du hast auf keinen Spieler geboten.' : 'Keine Spieler gefunden.'}
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
  // ScrollView setzt intern flexGrow: 1 (auch horizontal) — ohne das hier
  // auf 0 zu setzen, füllt die Zeile den ganzen restlichen Screen-Platz.
  chipScroll: {
    flexGrow: 0,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    // RN misst die Content-Höhe der ScrollView falsch, sobald der Inhalt
    // breiter als der Screen ist und wirklich gescrollt werden muss (mit nur
    // 3 Chips wie im Kader-Segment tritt der Bug nicht auf) — die Chips
    // schrumpfen dann auf reine Texthöhe ohne Padding. Feste Mindesthöhe
    // statt Auto behebt das zuverlässig.
    minHeight: 50,
  },
  chipDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.xs,
    backgroundColor: colors.border,
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
