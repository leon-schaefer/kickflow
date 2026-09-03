import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CompetitionPlayer } from '@/api/kickbase';
import { CompetitionPlayerRow } from '@/components/CompetitionPlayerRow';
import { PlayerFilterBar } from '@/components/PlayerFilterBar';
import { PlayerRowSeparator } from '@/components/PlayerRowFrame';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { SortChips, SortChipsDivider } from '@/components/SortChips';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useMarkInteractive } from '@/observe/useMarkInteractive';
import {
  useCompetitionPlayers,
  useCompetitionTeams,
  useLineup,
  useMarket,
  usePlaytimes,
} from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { PlayerFilterCriteria } from '@/utils/playerFilter';
import { EMPTY_PLAYER_FILTER, filterPlayers, isPlayerFilterActive } from '@/utils/playerFilter';
import {
  metricForSort,
  metricLabels,
  metricNeedsPlaytime,
  metricValue,
  type PlayerSortKey,
} from '@/utils/playerMetric';
import { playerOrigins } from '@/utils/playerOwnership';

// Modul-Konstante statt inline `[]`: usePlaytimes/useQueries brauchen eine
// referenziell stabile ID-Liste, sonst baut useQueries sie bei jedem Render neu.
const NO_PLAYTIME_IDS: string[] = [];

const SORT_OPTIONS: { key: PlayerSortKey; label: string; dividerBefore?: boolean }[] = [
  { key: 'marketValue', label: 'Marktwert' },
  { key: 'totalPoints', label: 'Punkte' },
  { key: 'avgPoints', label: 'Ø Punkte' },
  { key: 'avgPerMillion', label: metricLabels.avgPerMillion.chip, dividerBefore: true },
  { key: 'totalPerMillion', label: metricLabels.totalPerMillion.chip },
];

/**
 * Punkte/Min gibt es NUR mit aktivem Kader-Filter: die Kennzahl kostet einen
 * `/performance`-Request pro Spieler (siehe usePlaytimes). Über den eigenen
 * Kader sind das ~20 Requests wie früher im Kader-Tab, über den gesamten
 * Bestand wären es ~500 — deshalb hängt der Chip am Filter und nicht an der
 * Trefferzahl: eine Kennzahl, die beim Tippen im Suchfeld erscheint und
 * verschwindet, wäre nicht bedienbar.
 */
const PLAYTIME_SORT_OPTION: { key: PlayerSortKey; label: string; dividerBefore?: boolean } = {
  key: 'pointsPerMinute',
  label: metricLabels.pointsPerMinute.chip,
};

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

  // Kader-Filter und Herkunftshinweise an der Zeile. Beide Queries gehören
  // ohnehin zur App (Aufstellung/Markt) und werden über ihren Key geteilt —
  // nur ein Kaltstart direkt auf diesem Tab löst sie tatsächlich aus.
  const lineupQuery = useLineup(leagueId);
  const marketQuery = useMarket(leagueId);

  const [sortKey, setSortKey] = useState<PlayerSortKey>('marketValue');
  const [filter, setFilter] = useState<PlayerFilterCriteria>(EMPTY_PLAYER_FILTER);
  const [onlyMySquad, setOnlyMySquad] = useState(false);

  const mySquadIds = useMemo(
    () => (lineupQuery.data?.players ?? []).map((player) => player.id),
    [lineupQuery.data],
  );

  const origins = useMemo(
    () => playerOrigins(mySquadIds, (marketQuery.data?.players ?? []).map((player) => player.id)),
    [mySquadIds, marketQuery.data],
  );

  const teamsById = useMemo(
    () => new Map((teamsQuery.data ?? []).map((team) => [team.id, team])),
    [teamsQuery.data],
  );

  const metric = metricForSort(sortKey, 'marketValue');

  // Der Kader-Filter greift VOR Suche und Chips: er bestimmt die Grundmenge,
  // auf der auch die Spielzeit-Requests unten hängen.
  const pool = useMemo(() => {
    const players = playersQuery.data ?? [];
    if (!onlyMySquad) return players;
    const squadIds = new Set(mySquadIds);
    return players.filter((player) => squadIds.has(player.id));
  }, [playersQuery.data, onlyMySquad, mySquadIds]);

  // Spielminuten nur, wenn die aktive Sortierung sie braucht — und dann aus dem
  // UNGEFILTERTEN Pool, sonst würde jeder Tastendruck in der Suche sie neu
  // anfragen. Ohne Kader-Filter kann `metric` gar nicht 'pointsPerMinute' sein
  // (der Chip existiert dann nicht), die Menge bleibt also klein.
  const needsPlaytime = metricNeedsPlaytime(metric);
  const playtimeIds = useMemo(
    () => (needsPlaytime ? pool.map((player) => player.id) : NO_PLAYTIME_IDS),
    [pool, needsPlaytime],
  );
  const playtimeState = usePlaytimes(leagueId, playtimeIds);
  const { playtimes } = playtimeState;

  const visiblePlayers = useMemo(() => {
    const filtered = filterPlayers(pool, filter);
    return [...filtered].sort(
      (a, b) => metricValue(b, metric, playtimes.get(b.id)) - metricValue(a, metric, playtimes.get(a.id)),
    );
  }, [pool, filter, metric, playtimes]);

  /**
   * Beim Abschalten des Kader-Filters muss eine aktive Punkte/Min-Sortierung
   * mit weg: der Chip verschwindet, und ohne diesen Reset liefen die
   * Spielzeit-Requests anschließend über den GESAMTEN Bestand.
   */
  function toggleMySquad() {
    const next = !onlyMySquad;
    setOnlyMySquad(next);
    if (!next && sortKey === 'pointsPerMinute') setSortKey('marketValue');
  }

  const refresh = useRefresh(teamsQuery, playersQuery, lineupQuery, marketQuery, playtimeState);

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

      <SortChips
        options={onlyMySquad ? [...SORT_OPTIONS, PLAYTIME_SORT_OPTION] : SORT_OPTIONS}
        value={sortKey}
        onChange={setSortKey}
        leading={
          <>
            <Pressable
              style={[styles.filterChip, onlyMySquad && styles.filterChipActive]}
              onPress={toggleMySquad}
              accessibilityRole="button"
              accessibilityState={{ selected: onlyMySquad }}
            >
              <Text style={[styles.filterChipText, onlyMySquad && styles.filterChipTextActive]}>
                Mein Kader
              </Text>
            </Pressable>
            <SortChipsDivider />
          </>
        }
      />

      <Text style={styles.countHint}>
        {visiblePlayers.length === playersQuery.data.length
          ? `${playersQuery.data.length} Spieler`
          : `${visiblePlayers.length} von ${playersQuery.data.length} Spielern`}
      </Text>

      {/* Ohne diesen Hinweis wirkt das Nachsortieren während des Ladens wie ein Fehler. */}
      {playtimeState.pending > 0 && (
        <Text style={styles.countHint}>
          Spielzeiten … {playtimeState.total - playtimeState.pending}/{playtimeState.total}
        </Text>
      )}

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
                playtime={playtimes.get(item.id)}
                onPress={openPlayer}
              />
            )}
            ItemSeparatorComponent={PlayerRowSeparator}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {/* Eigener Text je Ursache — „Keine Spieler gefunden“ würde bei
                    aktivem Kader-Filter wie ein Ladefehler wirken, und solange
                    der Kader noch lädt, ist die leere Liste nur ein Zwischenstand. */}
                <Text style={styles.emptyText}>
                  {onlyMySquad && !lineupQuery.data
                    ? 'Kader wird geladen …'
                    : onlyMySquad
                      ? 'Kein Spieler aus deinem Kader passt zum Filter.'
                      : isPlayerFilterActive(filter)
                        ? 'Kein Spieler passt zum Filter.'
                        : 'Keine Spieler gefunden.'}
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
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.accent,
    fontWeight: '600',
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
