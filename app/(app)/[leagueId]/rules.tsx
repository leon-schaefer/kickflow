import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Checkbox } from '@/components/Checkbox';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useCurrentLeague } from '@/leagues/useCurrentLeague';
import { useFocusedLeagueTabTitle } from '@/leagues/useFocusedLeagueTabTitle';
import { DEFAULT_RULES, type MaxPerTeamRule } from '@/lineup/rules';
import { useLeagueRules } from '@/lineup/useLeagueRules';
import { useCompetitionTeams, useLineup } from '@/queries/hooks';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { isAvailableForLineup } from '@/utils/lineupOptimizer';

const QUICK_VALUES = [1, 2, 3, 4, 5];

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
  const { rules, updateRule } = useLeagueRules(leagueId);
  const { data: lineup } = useLineup(leagueId);
  const { data: teams } = useCompetitionTeams(competitionId);

  const teamNames = useMemo(() => new Map((teams ?? []).map((team) => [team.id, team.name])), [teams]);

  const maxPerTeamRule = (rules.find((rule): rule is MaxPerTeamRule => rule.kind === 'maxPerTeam') ??
    DEFAULT_RULES[0]) as MaxPerTeamRule;

  const players = lineup?.players ?? [];

  const teamRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const player of players) counts.set(player.teamId, (counts.get(player.teamId) ?? 0) + 1);
    return [...counts.entries()]
      .map(([teamId, count]) => ({ teamId, name: teamNames.get(teamId) ?? teamId, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [players, teamNames]);

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
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Checkbox
            label="Max. Spieler pro Verein"
            checked={maxPerTeamRule.enabled}
            onChange={(enabled) => updateRule('maxPerTeam', { enabled })}
            hint={
              maxPerTeamRule.enabled
                ? 'Gilt für jeden Verein gleich — der Optimizer hält sich immer daran.'
                : 'Regel ist aus — der Optimizer ignoriert sie.'
            }
          />
          <View style={styles.chipRow}>
            {QUICK_VALUES.map((value) => (
              <Pressable
                key={value}
                style={[
                  styles.chip,
                  maxPerTeamRule.max === value && styles.chipActive,
                  !maxPerTeamRule.enabled && styles.chipDisabled,
                ]}
                onPress={() => updateRule('maxPerTeam', { max: value })}
                disabled={!maxPerTeamRule.enabled}
              >
                <Text style={[styles.chipText, maxPerTeamRule.max === value && styles.chipTextActive]}>{value}</Text>
              </Pressable>
            ))}
          </View>
        </View>

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
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: '600',
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
