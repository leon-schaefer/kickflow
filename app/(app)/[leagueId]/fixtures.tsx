import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FixtureDifficultyStrip } from '@/components/FixtureDifficultyStrip';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { TeamLogo } from '@/components/TeamLogo';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useFocusedLeagueTabTitle } from '@/leagues/useFocusedLeagueTabTitle';
import { useCompetitionTeams, useMatchdays } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import {
  averageDifficulty,
  buildFixtureIndex,
  fixtureDifficulty,
  remainingFixtures,
  teamGoalRecord,
  teamStrength,
} from '@/utils/fixtureDifficulty';
import { resolveMatchdayState } from '@/utils/matchday';

type Lens = 'attack' | 'defense';
type Lookahead = 5 | 10;

const LENS_OPTIONS: { key: Lens; label: string }[] = [
  { key: 'attack', label: 'Angriff' },
  { key: 'defense', label: 'Abwehr' },
];

/**
 * Restprogramm/Gegner-Härte über die ganze Liga — nicht nur den eigenen
 * Kader. Erreichbar über die "Restprogramm"-Zeile im Liga-Header (siehe
 * value.tsx/lineup.tsx). Keine eigene Datenquelle: derselbe Spielplan, den
 * useMatchdays ohnehin lädt (15 min Stale-Time), reduziert auf Tore-Bilanz —
 * siehe src/utils/fixtureDifficulty.ts für die Begründung, warum das ohne
 * einen neuen Kickbase-Endpoint auskommt.
 */
export default function FixturesScreen() {
  const competitionId = useCompetitionId();
  const backTitle = useFocusedLeagueTabTitle();
  const matchdaysQuery = useMatchdays(competitionId);
  const teamsQuery = useCompetitionTeams(competitionId);
  const refresh = useRefresh(matchdaysQuery, teamsQuery);
  const [lens, setLens] = useState<Lens>('attack');
  const [lookahead, setLookahead] = useState<Lookahead>(5);

  const rows = useMemo(() => {
    if (!matchdaysQuery.data || !teamsQuery.data) return [];
    const schedule = matchdaysQuery.data;
    const fromDay = resolveMatchdayState(schedule, Date.now()).open?.day ?? schedule.currentDay ?? 1;
    const index = buildFixtureIndex(schedule);
    const strengths = teamStrength(teamGoalRecord(schedule));

    return teamsQuery.data
      .map((team) => {
        const upcoming = remainingFixtures(team.id, index, fromDay, lookahead);
        const ratings = fixtureDifficulty(upcoming, strengths);
        return { team, ratings, average: averageDifficulty(ratings) };
      })
      .filter((row) => row.ratings.length > 0)
      .sort((a, b) => a.average[lens] - b.average[lens]);
  }, [matchdaysQuery.data, teamsQuery.data, lookahead, lens]);

  if (!matchdaysQuery.data || !teamsQuery.data) {
    return (
      <>
        <Stack.Screen.BackButton>{backTitle}</Stack.Screen.BackButton>
        <QueryState query={matchdaysQuery.data ? teamsQuery : matchdaysQuery} label="Restprogramm" refresh={refresh} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen.BackButton>{backTitle}</Stack.Screen.BackButton>
      <Stack.Title>Restprogramm</Stack.Title>
      <Refreshable {...refresh}>
        {(p) => (
          <ScrollView {...p} style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.controlRow}>
              <View style={styles.segmentGroup}>
                {LENS_OPTIONS.map((option) => (
                  <Pressable
                    key={option.key}
                    style={[styles.segmentChip, lens === option.key && styles.segmentChipActive]}
                    onPress={() => setLens(option.key)}
                  >
                    <Text style={[styles.segmentText, lens === option.key && styles.segmentTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.segmentGroup}>
                {([5, 10] as const).map((n) => (
                  <Pressable
                    key={n}
                    style={[styles.segmentChip, lookahead === n && styles.segmentChipActive]}
                    onPress={() => setLookahead(n)}
                  >
                    <Text style={[styles.segmentText, lookahead === n && styles.segmentTextActive]}>{n} Spiele</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={styles.hint}>
              {lens === 'attack'
                ? 'Wie schwer wird es für Stürmer/Mittelfeld, gegen die nächsten Gegner zu treffen — sortiert vom leichtesten Restprogramm.'
                : 'Wie schwer wird es für Abwehr/Torwart, gegen die nächsten Gegner ohne Gegentor zu bleiben — sortiert vom leichtesten Restprogramm.'}
            </Text>

            <View style={styles.list}>
              {rows.map(({ team, ratings, average }) => (
                <View key={team.id} style={styles.row}>
                  <View style={styles.teamCell}>
                    <TeamLogo uri={team.logoUrl} size={22} />
                    <Text style={styles.teamName} numberOfLines={1}>
                      {team.name || `Team ${team.id}`}
                    </Text>
                  </View>
                  <View style={styles.fixtureCells}>
                    <FixtureDifficultyStrip ratings={ratings} lens={lens} />
                  </View>
                  <Text style={styles.avgText}>{formatAverage(average[lens])}</Text>
                </View>
              ))}
            </View>

            {rows.length === 0 && <Text style={styles.emptyText}>Noch kein Restprogramm verfügbar.</Text>}
          </ScrollView>
        )}
      </Refreshable>
    </>
  );
}

function formatAverage(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
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
  controlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  segmentGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segmentChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  segmentText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  hint: {
    ...typography.small,
    color: colors.textMuted,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teamCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    width: 96,
  },
  teamName: {
    ...typography.caption,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  fixtureCells: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  avgText: {
    ...typography.caption,
    color: colors.textMuted,
    width: 36,
    textAlign: 'right',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingTop: spacing.xl,
  },
});
