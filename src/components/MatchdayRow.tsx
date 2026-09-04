import { StyleSheet, Text, View } from 'react-native';
import type { MatchdayPerformance } from '@/api/kickbase';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { toFixtureView } from '@/utils/matchday';
import { formatPoints } from '@/utils/format';
import { TeamLogo } from './TeamLogo';

interface MatchdayRowProps {
  matchday: MatchdayPerformance;
  /** Fallback, falls `matchday.playerTeamId` ausnahmsweise leer ist — i.d.R. `PlayerDetail.teamId`. */
  playerTeamId: string;
  /** teamId → Name, aus `useCompetitionTeams()`. Unbekannte Gegner fallen auf "Team {id}" zurück. */
  teamNames: Map<string, string>;
}

const outcomeColors = {
  win: colors.positive,
  draw: colors.textSecondary,
  loss: colors.negative,
} as const;

export function MatchdayRow({ matchday, playerTeamId, teamNames }: MatchdayRowProps) {
  const fixture = toFixtureView(matchday, playerTeamId, teamNames);

  return (
    <View style={styles.row}>
      <Text style={styles.matchdayLabel}>ST {matchday.matchday}</Text>
      <Text style={styles.venue}>{fixture.isHome ? 'H' : 'A'}</Text>
      <View style={styles.opponent}>
        <TeamLogo uri={fixture.opponentLogoUrl} />
        <Text style={styles.opponentName} numberOfLines={1}>
          {fixture.opponentName}
        </Text>
      </View>
      <Text style={[styles.score, { color: outcomeColors[fixture.outcome] }]}>
        {fixture.ownGoals}:{fixture.opponentGoals}
      </Text>
      <Text style={styles.minutes}>{matchday.minutesPlayed}'</Text>
      <Text style={styles.points}>{formatPoints(matchday.points)} P</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  matchdayLabel: {
    ...typography.caption,
    color: colors.textMuted,
    width: 40,
  },
  venue: {
    ...typography.small,
    color: colors.textMuted,
    width: 14,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  opponent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  opponentName: {
    ...typography.caption,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  score: {
    ...typography.caption,
    fontWeight: '700',
    width: 36,
    textAlign: 'center',
  },
  minutes: {
    ...typography.small,
    color: colors.textMuted,
    width: 28,
    textAlign: 'right',
  },
  points: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 56,
    textAlign: 'right',
  },
});
