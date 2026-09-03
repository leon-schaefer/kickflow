import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CompetitionPlayer } from '@/api/kickbase';
import { CompetitionPlayerRow } from '@/components/CompetitionPlayerRow';
import { PlayerFilterBar } from '@/components/PlayerFilterBar';
import { PlayerRowSeparator } from '@/components/PlayerRowFrame';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { SortChips } from '@/components/SortChips';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useMarkInteractive } from '@/observe/useMarkInteractive';
import { useCompetitionPlayers, useCompetitionTeams, useLineup, useMarket } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, spacing, typography } from '@/theme/tokens';
import type { PlayerFilterCriteria } from '@/utils/playerFilter';
import { EMPTY_PLAYER_FILTER, filterPlayers, isPlayerFilterActive } from '@/utils/playerFilter';
import { metricForSort, metricLabels, metricValue, type PlayerSortKey } from '@/utils/playerMetric';
import { playerOrigins } from '@/utils/playerOwnership';

/**
 * Kein 'pointsPerMinute'-Chip wie im Kader und im Markt: die Kennzahl kostet
 * einen `/performance`-Request PRO SPIELER (siehe usePlaytimes), und dieser
 * Bestand umfasst alle ~500 Spieler der Competition. Auf einer einzelnen
 * Spielerseite ist die Zahl weiterhin zu haben.
 */
const SORT_OPTIONS: { key: PlayerSortKey; label: string; dividerBefore?: boolean }[] = [
  { key: 'marketValue', label: 'Marktwert' },
  { key: 'totalPoints', label: 'Punkte' },
  { key: 'avgPoints', label: 'Ø Punkte' },
  { key: 'avgPerMillion', label: metricLabels.avgPerMillion.chip, dividerBefore: true },
  { key: 'totalPerMillion', label: metricLabels.totalPerMillion.chip },
];

/**
 * Alle Spieler der Competition — der einzige Screen, der auch Spieler zeigt,
 * die weder im eigenen Kader stehen noch im Transfermarkt gelistet sind.
 * Antippen führt auf dasselbe Spielerprofil wie Kader und Markt; das
 * funktioniert für jede Spieler-ID, nicht nur für eigene (siehe getPlayer).
 *
 * Suche, Filter und Sortierung laufen rein lokal auf dem geladenen Bestand —
 * deshalb wird er komplett geholt (ein Request je Verein, 30 Minuten frisch)
 * statt serverseitig zu suchen: nur so greifen Vereins-/Positionsfilter und
 * die Wert-Kennzahlen über den GESAMTEN Bestand statt über eine Trefferliste.
 */
export default function PlayersScreen() {
  const leagueId = useLeagueId();
  const competitionId = useCompetitionId();
  const router = useRouter();

  const teamsQuery = useCompetitionTeams(competitionId);
  // Stabil memoisiert: die Liste geht als Argument in getCompetitionPlayers.
  const teamIds = useMemo(() => (teamsQuery.data ?? []).map((team) => team.id), [teamsQuery.data]);
  const playersQuery = useCompetitionPlayers(competitionId, teamIds);
  useMarkInteractive(!!playersQuery.data);

  // Nur für die Herkunftshinweise an der Zeile. Beide Queries sind ohnehin
  // Teil der App (Aufstellung/Markt) und werden über den Query-Key geteilt —
  // hier entsteht höchstens beim Kaltstart auf diesem Tab ein Request.
  const lineupQuery = useLineup(leagueId);
  const marketQuery = useMarket(leagueId);

  const refresh = useRefresh(teamsQuery, playersQuery, lineupQuery, marketQuery);

  const [sortKey, setSortKey] = useState<PlayerSortKey>('marketValue');
  const [filter, setFilter] = useState<PlayerFilterCriteria>(EMPTY_PLAYER_FILTER);

  const origins = useMemo(
    () =>
      playerOrigins(
        (lineupQuery.data?.players ?? []).map((player) => player.id),
        (marketQuery.data?.players ?? []).map((player) => player.id),
      ),
    [lineupQuery.data, marketQuery.data],
  );

  const teamsById = useMemo(
    () => new Map((teamsQuery.data ?? []).map((team) => [team.id, team])),
    [teamsQuery.data],
  );

  const metric = metricForSort(sortKey, 'marketValue');

  const visiblePlayers = useMemo(() => {
    const filtered = filterPlayers(playersQuery.data ?? [], filter);
    return [...filtered].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
  }, [playersQuery.data, filter, metric]);

  function openPlayer(player: CompetitionPlayer) {
    router.push(`/${leagueId}/player/${player.id}`);
  }

  // Die Vereinsliste ist Voraussetzung für den Bestand (ein Request je Verein)
  // — ohne sie wäre der Spielerquery dauerhaft deaktiviert und ein Spinner
  // ohne Erklärung stehen geblieben.
  if (!teamsQuery.data) {
    return <QueryState query={teamsQuery} label="Vereine" refresh={refresh} />;
  }
  // Eine leere Vereinsliste (`table` ohne `it`) hält den Spielerquery dauerhaft
  // deaktiviert — QueryState hätte dann keinen Fehler zu zeigen und würde
  // endlos drehen. Deshalb hier eine Aussage statt eines Spinners.
  if (teamsQuery.data.length === 0) {
    return (
      <Refreshable {...refresh}>
        {(p) => (
          <ScrollView {...p} style={styles.container} contentContainerStyle={styles.centerContent}>
            <Text style={styles.emptyText}>
              Für diese Liga sind keine Vereine bekannt — ohne sie lässt sich der Spielerbestand nicht
              laden.
            </Text>
          </ScrollView>
        )}
      </Refreshable>
    );
  }
  if (!playersQuery.data) {
    return <QueryState query={playersQuery} label="Spielerbestand" refresh={refresh} />;
  }

  return (
    <View style={styles.container}>
      <PlayerFilterBar criteria={filter} onChange={setFilter} teams={teamsQuery.data} />

      <SortChips options={SORT_OPTIONS} value={sortKey} onChange={setSortKey} />

      <Text style={styles.countHint}>
        {visiblePlayers.length === playersQuery.data.length
          ? `${playersQuery.data.length} Spieler`
          : `${visiblePlayers.length} von ${playersQuery.data.length} Spielern`}
      </Text>

      <Refreshable {...refresh}>
        {(p) => (
          <FlatList
            {...p}
            data={visiblePlayers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CompetitionPlayerRow
                player={item}
                metric={metric}
                teamName={teamsById.get(item.teamId)?.name}
                teamLogoUrl={teamsById.get(item.teamId)?.logoUrl}
                origin={origins.get(item.id)}
                onPress={openPlayer}
              />
            )}
            ItemSeparatorComponent={PlayerRowSeparator}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {isPlayerFilterActive(filter) ? 'Kein Spieler passt zum Filter.' : 'Keine Spieler gefunden.'}
                </Text>
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
  countHint: {
    ...typography.small,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  centerContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
