import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaxPerTeamRuleCard } from '@/components/MaxPerTeamRuleCard';
import { Refreshable } from '@/components/Refreshable';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useCurrentLeague } from '@/leagues/useCurrentLeague';
import { useFocusedLeagueTabTitle } from '@/leagues/useFocusedLeagueTabTitle';
import { useLeagueRulesContext } from '@/lineup/LeagueRulesContext';
import { DEFAULT_RULES, type MaxPerTeamRule } from '@/lineup/rules';
import { useMarkInteractive } from '@/observe/useMarkInteractive';
import { useCompetitionTeams, useLineup } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { isAvailableForLineup } from '@/utils/lineupOptimizer';
import { countByTeam } from '@/utils/teamDistribution';

/**
 * Liga-eigene Optimizer-Regeln. Erreichbar über die "Regeln"-Zeile in
 * OptimizerBar (Aufstellungs-Tab). Registriert als Stack-Screen neben
 * player/[playerId] in [leagueId]/_layout.tsx, nicht als Tab — Vorbild für
 * Back-Button-Label und Titel ist player/[playerId].tsx.
 */
export default function RulesScreen() {
  const leagueId = useLeagueId();
  const competitionId = useCompetitionId();
  const league = useCurrentLeague();
  const backTitle = useFocusedLeagueTabTitle();
  const { rules, updateRule, loaded, leagueMax } = useLeagueRulesContext();
  useMarkInteractive(loaded);
  const lineupQuery = useLineup(leagueId);
  const { data: lineup } = lineupQuery;
  const { data: teams } = useCompetitionTeams(competitionId);
  const refresh = useRefresh(lineupQuery);

  const teamNames = useMemo(() => new Map((teams ?? []).map((team) => [team.id, team.name])), [teams]);

  const maxPerTeamRule = (rules.find((rule): rule is MaxPerTeamRule => rule.kind === 'maxPerTeam') ??
    DEFAULT_RULES[0]) as MaxPerTeamRule;

  const players = lineup?.players ?? [];

  const teamRows = useMemo(() => countByTeam(players, teamNames), [players, teamNames]);

  // Nur einsatzfähige Spieler zählen für die Aufstellbar-Obergrenze — ein
  // verletzter Spieler bindet zwar einen Kaderplatz beim Verein, aber nie
  // einen Elf-Platz, egal was die Regel erlaubt.
  const startableCeiling = useMemo(() => {
    if (!maxPerTeamRule.enabled) return null;
    const counts = new Map<string, number>();
    for (const player of players) {
      if (!isAvailableForLineup(player.status)) continue;
      counts.set(player.teamId, (counts.get(player.teamId) ?? 0) + 1);
    }
    let total = 0;
    for (const count of counts.values()) total += Math.min(count, maxPerTeamRule.max);
    return Math.min(total, 11);
  }, [players, maxPerTeamRule]);

  return (
    <>
      <Stack.Screen.BackButton>{backTitle}</Stack.Screen.BackButton>
      <Stack.Title>{league ? `Regeln · ${league.name}` : 'Regeln'}</Stack.Title>
      <Refreshable {...refresh}>
        {(p) => (
          <ScrollView {...p} style={styles.container} contentContainerStyle={styles.content}>
        {/*
         * Erst nach dem Laden rendern: Bis dahin stünden hier die DEFAULT_RULES
         * (enabled: false), und ein Klick in diesem Fenster würde vom
         * nachziehenden Storage-Wert überschrieben — und obendrein den falschen
         * Stand persistieren (siehe useLeagueRules.ts).
         */}
        {loaded && (
          <MaxPerTeamRuleCard
            rule={maxPerTeamRule}
            onChange={(patch) => updateRule('maxPerTeam', patch)}
            leagueMax={leagueMax}
          />
        )}

        {teamRows.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dein Kader</Text>
            {teamRows.map((row) => {
              const overLimit = maxPerTeamRule.enabled && row.count > maxPerTeamRule.max;
              return (
                <View key={row.teamId} style={styles.teamRow}>
                  <Text style={styles.teamName}>{row.name}</Text>
                  <Text style={[styles.teamCount, overLimit && styles.teamCountOver]}>
                    {row.count} Spieler{overLimit ? ' · über Grenze' : ''}
                  </Text>
                </View>
              );
            })}
            {startableCeiling !== null && (
              <Text style={styles.ceiling}>
                Aufstellbar: höchstens {startableCeiling} von 11
                {startableCeiling < 11 ? ' — engt die Formation ein' : ''}
              </Text>
            )}
          </View>
        )}
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
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  teamName: {
    ...typography.body,
    color: colors.textPrimary,
  },
  teamCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  teamCountOver: {
    color: colors.danger,
    fontWeight: '600',
  },
  ceiling: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
