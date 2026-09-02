import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PlayerDetail, SquadPlayer } from '@/api/kickbase';
import { Pitch } from '@/components/Pitch';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useFocusedLeagueTabTitle } from '@/leagues/useFocusedLeagueTabTitle';
import { useCompetitionTeams, useLeagueRanking, useManagerLineup } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatCurrency, formatPoints } from '@/utils/format';
import { countByPosition, countByTeam } from '@/utils/teamDistribution';
import { pointsPerMillion } from '@/utils/valueScore';

/**
 * Die Startelf eines Rivalen — Vereins-/Positionsverteilung plus Pitch-Ansicht.
 * Erreichbar durch Antippen einer Zeile in league.tsx. `lineupPlayerIds`
 * (aus `/leagues/{id}/ranking`) sind NUR die Startelf, nicht der ganze Kader
 * — Bankspieler eines Rivalen bleiben unsichtbar, das wird unten benannt.
 */
export default function ManagerDetailScreen() {
  const leagueId = useLeagueId();
  const competitionId = useCompetitionId();
  const backTitle = useFocusedLeagueTabTitle();
  const { managerId } = useLocalSearchParams<{ managerId: string }>();

  const rankingQuery = useLeagueRanking(leagueId);
  const entry = rankingQuery.data?.entries.find((e) => e.userId === managerId) ?? null;

  const { data: competitionTeams } = useCompetitionTeams(competitionId);
  const teamNames = useMemo(
    () => new Map((competitionTeams ?? []).map((team) => [team.id, team.name])),
    [competitionTeams],
  );

  const lineupIds = useMemo(() => entry?.lineupPlayerIds ?? [], [entry]);
  const managerLineup = useManagerLineup(leagueId, lineupIds);
  const refresh = useRefresh(rankingQuery, managerLineup);

  const players = useMemo(() => {
    const resolved: SquadPlayer[] = [];
    lineupIds.forEach((playerId, index) => {
      if (!playerId) return;
      const detail = managerLineup.players.get(playerId);
      if (detail) resolved.push(toRivalSquadPlayer(detail, index));
    });
    return resolved;
  }, [lineupIds, managerLineup.players]);

  const teamRows = useMemo(() => countByTeam(players, teamNames), [players, teamNames]);
  const positionRows = useMemo(() => countByPosition(players), [players]);
  const teamValue = useMemo(() => players.reduce((sum, p) => sum + p.marketValue, 0), [players]);
  const averagePoints = players.length > 0 ? players.reduce((sum, p) => sum + p.averagePoints, 0) / players.length : 0;

  if (!rankingQuery.data) {
    return (
      <>
        <Stack.Screen.BackButton>{backTitle}</Stack.Screen.BackButton>
        <QueryState query={rankingQuery} label="Manager" refresh={refresh} />
      </>
    );
  }

  if (!entry) {
    return (
      <>
        <Stack.Screen.BackButton>{backTitle}</Stack.Screen.BackButton>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Manager nicht gefunden.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen.BackButton>{backTitle}</Stack.Screen.BackButton>
      <Stack.Title>{entry.userName}</Stack.Title>
      <Refreshable {...refresh}>
        {(p) => (
          <ScrollView {...p} style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.statsGrid}>
              <Stat label="Platz" value={entry.seasonPlace ? String(entry.seasonPlace) : '—'} />
              <Stat label="Saisonpunkte" value={formatPoints(entry.seasonPoints)} />
              <Stat label="Spieltagspunkte" value={formatPoints(entry.matchdayPoints)} />
              <Stat label="Teamwert (Liga)" value={formatCurrency(entry.teamValue)} />
            </View>

            {managerLineup.pending > 0 && (
              <Text style={styles.hint}>
                Elf wird geladen … {managerLineup.total - managerLineup.pending}/{managerLineup.total}
              </Text>
            )}

            {players.length > 0 && (
              <>
                <Pitch players={players} />

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Startelf-Kennzahlen</Text>
                  <Text style={styles.cardLine}>Marktwert der Startelf: {formatCurrency(teamValue)}</Text>
                  <Text style={styles.cardLine}>Ø-Punkte der Startelf: {formatPoints(Math.round(averagePoints))}</Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Vereinsverteilung</Text>
                  {teamRows.map((row) => (
                    <View key={row.teamId} style={styles.distributionRow}>
                      <Text style={styles.distributionName}>{row.name}</Text>
                      <Text style={styles.distributionCount}>{row.count}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Positionsverteilung</Text>
                  {positionRows.map((row) => (
                    <View key={row.position} style={styles.distributionRow}>
                      <Text style={styles.distributionName}>{row.position}</Text>
                      <Text style={styles.distributionCount}>{row.count}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.disclaimer}>
              Nur die Startelf ist sichtbar — die Kickbase-API liefert für andere Manager keinen Bankspieler.
            </Text>
          </ScrollView>
        )}
      </Refreshable>
    </>
  );
}

/**
 * `PlayerDetail` (aus getPlayerBasic) → `SquadPlayer`, damit `Pitch`/`PlayerCard`
 * unverändert wiederverwendbar bleiben. Felder, die `PlayerDetail` nicht kennt
 * (Kader-/Marktkontext eines FREMDEN Managers — Kapitän, Bankstatus, eigenes
 * Gebot …), bekommen neutrale Defaults; `PlayerCard` liest sie ohnehin nicht.
 */
function toRivalSquadPlayer(detail: PlayerDetail, lineupSlot: number): SquadPlayer {
  return {
    id: detail.id,
    name: detail.name,
    firstName: detail.firstName,
    lastName: detail.lastName,
    position: detail.position,
    teamId: detail.teamId,

    marketValue: detail.marketValue,
    marketValueTrend: detail.marketValueTrend,
    marketValueChangeToday: 0,

    totalPoints: detail.totalPoints,
    averagePoints: detail.averagePoints,
    valueScoreAvg: pointsPerMillion(detail.averagePoints, detail.marketValue),
    valueScoreTotal: pointsPerMillion(detail.totalPoints, detail.marketValue),

    status: detail.status,
    statusDetails: detail.statusDetails,

    imageUrl: detail.imageUrl,
    teamLogoUrl: detail.teamLogoUrl,

    inLineup: true,
    lineupSlot,
    isCaptain: false,

    onMarket: false,
    offerCount: 0,

    nextMatch: null,
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  stat: {
    width: '46%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 2,
  },
  statValue: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.small,
    color: colors.textMuted,
  },
  hint: {
    ...typography.small,
    color: colors.textMuted,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  cardLine: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  distributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  distributionName: {
    ...typography.body,
    color: colors.textPrimary,
  },
  distributionCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  disclaimer: {
    ...typography.small,
    color: colors.textMuted,
  },
});
