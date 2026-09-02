import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SquadPlayer } from '@/api/kickbase';
import { Pitch } from '@/components/Pitch';
import { PlayerCard } from '@/components/PlayerCard';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useFocusedLeagueTabTitle } from '@/leagues/useFocusedLeagueTabTitle';
import { useLeagueRanking, useManagerSquad } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, layout, spacing, typography } from '@/theme/tokens';
import { formatCurrency, formatPoints } from '@/utils/format';

/**
 * Aufstellung eines Managers aus der Liga-Tabelle: Startelf auf dem Spielfeld,
 * Rest auf der Bank. Beides antippbar — der Tap führt ins Spielerprofil,
 * genau wie im eigenen Aufstellungs-Tab.
 *
 * Nur Anzeige: an einem fremden Kader gibt es nichts zu bearbeiten, deshalb
 * kein Editier-Modus und kein Optimizer.
 */
export default function ManagerScreen() {
  const leagueId = useLeagueId();
  const { managerId } = useLocalSearchParams<{ managerId: string }>();
  const router = useRouter();
  const squadQuery = useManagerSquad(leagueId, managerId);
  const { data } = squadQuery;
  // Punkte und Platz stehen nur in der Tabelle, nicht in der Kader-Antwort.
  // Dieselbe Query wie im Liga-Tab — React Query dedupliziert über den Key,
  // beim Weg über die Tabelle kostet das keinen zusätzlichen Request.
  const rankingQuery = useLeagueRanking(leagueId);
  const manager = rankingQuery.data?.find((entry) => entry.id === managerId) ?? null;
  const refresh = useRefresh(squadQuery, rankingQuery);
  const backTitle = useFocusedLeagueTabTitle();

  function openPlayer(player: SquadPlayer) {
    router.push(`/${leagueId}/player/${player.id}`);
  }

  const title = data?.managerName || manager?.name || 'Manager';

  if (!data) {
    return (
      <>
        <Stack.Screen.BackButton>{backTitle}</Stack.Screen.BackButton>
        <Stack.Title>{title}</Stack.Title>
        <QueryState query={squadQuery} label="Aufstellung" refresh={refresh} />
      </>
    );
  }

  const lineupPlayers = data.players.filter((p) => p.inLineup);
  const bench = data.players.filter((p) => !p.inLineup);

  return (
    <>
      <Stack.Screen.BackButton>{backTitle}</Stack.Screen.BackButton>
      <Stack.Title>{title}</Stack.Title>
      <Refreshable {...refresh}>
        {(p) => (
          <ScrollView {...p} style={styles.container} contentContainerStyle={styles.content}>
            {/*
              * Der Name steht schon im Navigationstitel — hier deshalb die
              * Tabellenwerte: links Platz/Punkte, rechts der Teamwert.
              * „—“ statt einer Zeile weniger: die Kopfzeile soll beim
              * Nachladen der Tabelle nicht in der Höhe springen.
              */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerLabel}>
                  {manager?.placement != null ? `Platz ${manager.placement}` : 'Platz —'}
                </Text>
                <Text style={styles.headerSub}>
                  {manager?.seasonPoints != null
                    ? `${formatPoints(manager.seasonPoints)} Punkte`
                    : 'Punkte —'}
                  {manager?.matchdayPoints != null
                    ? ` · ST ${formatPoints(manager.matchdayPoints)}`
                    : ''}
                </Text>
              </View>
              <View style={styles.headerStats}>
                <Text style={styles.headerLabel}>{formatCurrency(data.teamValue)}</Text>
                <Text style={styles.headerSub}>Teamwert</Text>
              </View>
            </View>

            <Text style={styles.formation}>{data.formation || '—'}</Text>

            {lineupPlayers.length > 0 ? (
              <Pitch players={lineupPlayers} onSelectPlayer={openPlayer} />
            ) : (
              <Text style={styles.hint}>
                Für diesen Manager ist keine Startelf hinterlegt — der komplette Kader steht unten.
              </Text>
            )}

            <Text style={styles.sectionTitle}>Bank ({bench.length})</Text>
            <View style={styles.bench}>
              {bench.map((player) => (
                <PlayerCard key={player.id} player={player} onPress={openPlayer} />
              ))}
            </View>
          </ScrollView>
        )}
      </Refreshable>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerStats: {
    alignItems: 'flex-end',
  },
  headerLabel: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  headerSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  formation: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  bench: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
