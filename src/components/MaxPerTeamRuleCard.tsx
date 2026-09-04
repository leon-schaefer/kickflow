import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Checkbox } from '@/components/Checkbox';
import type { MaxPerTeamRule } from '@/lineup/rules';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const QUICK_VALUES = [1, 2, 3, 4, 5];

interface MaxPerTeamRuleCardProps {
  rule: MaxPerTeamRule;
  onChange: (patch: Partial<MaxPerTeamRule>) => void;
  /** Kickbases eigener Wert für diese Liga (`overview.mpst`), nur für den Hinweistext. */
  leagueMax: number | null;
}

/**
 * Checkbox + Wert-Chips für die maxPerTeam-Regel — aus rules.tsx herausgezogen,
 * damit die Karte identisch im Regel-Screen UND im Liga-Tab (league.tsx)
 * erscheint, statt zweimal denselben Code zu pflegen. Beide Aufrufer nutzen
 * `useLeagueRulesContext()`, der State ist also ohnehin geteilt (siehe dort).
 */
export function MaxPerTeamRuleCard({ rule, onChange, leagueMax }: MaxPerTeamRuleCardProps) {
  const hintParts = [
    rule.enabled
      ? 'Gilt für jeden Verein gleich — der Optimizer hält sich immer daran.'
      : 'Regel ist aus — der Optimizer ignoriert sie.',
  ];
  if (leagueMax !== null && leagueMax !== rule.max) {
    hintParts.push(`Kickbase erlaubt in dieser Liga max. ${leagueMax} pro Verein.`);
  }

  return (
    <View style={styles.card}>
      <Checkbox
        label="Max. Spieler pro Verein"
        checked={rule.enabled}
        onChange={(enabled) => onChange({ enabled })}
        hint={hintParts.join(' ')}
      />
      <View style={styles.chipRow}>
        {QUICK_VALUES.map((value) => (
          <Pressable
            key={value}
            style={[styles.chip, rule.max === value && styles.chipActive, !rule.enabled && styles.chipDisabled]}
            onPress={() => onChange({ max: value })}
            disabled={!rule.enabled}
          >
            <Text style={[styles.chipText, rule.max === value && styles.chipTextActive]}>{value}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
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
});
