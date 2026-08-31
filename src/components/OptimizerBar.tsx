import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Position } from '@/api/kickbase';
import type { OptimizerDiff } from '@/lineup/useLineupOptimizer';
import { colors, positionLabels, radius, spacing, typography } from '@/theme/tokens';
import { formatPoints, formatValueScore } from '@/utils/format';
import type { OptimizationResult, OptimizerMetric } from '@/utils/lineupOptimizer';

const METRIC_OPTIONS: { key: OptimizerMetric; label: string }[] = [
  { key: 'valuePerMillion', label: 'Ø-Punkte/Mio' },
  { key: 'points', label: 'Ø-Punkte' },
];

interface OptimizerBarProps {
  metric: OptimizerMetric;
  onChangeMetric: (metric: OptimizerMetric) => void;
  result: OptimizationResult;
  /** Eingefroren zum Zeitpunkt des letzten "Optimieren" — null, solange noch nicht übernommen. */
  appliedDiff: OptimizerDiff | null;
  onApply: () => void;
  onReset: () => void;
}

function formatScore(score: number, metric: OptimizerMetric): string {
  return metric === 'valuePerMillion' ? `Ø ${formatValueScore(score)} Pkt/Mio` : `Ø ${formatPoints(Math.round(score))} Pkt`;
}

/** Formationswahl + Zielmetrik für den Aufstellungs-Optimizer. Nur im Edit-Modus sichtbar. */
export function OptimizerBar({ metric, onChangeMetric, result, appliedDiff, onApply, onReset }: OptimizerBarProps) {
  const { best } = result;

  return (
    <View style={styles.container}>
      <View style={styles.metricRow}>
        {METRIC_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            style={[styles.metricChip, metric === option.key && styles.metricChipActive]}
            onPress={() => onChangeMetric(option.key)}
          >
            <Text style={[styles.metricChipText, metric === option.key && styles.metricChipTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.applyButton, !best && styles.applyButtonDisabled]}
          onPress={onApply}
          disabled={!best}
        >
          <Text style={styles.applyButtonText}>Optimieren</Text>
        </Pressable>
        <View style={styles.resultInfo}>
          {best ? (
            <Text style={styles.resultText}>
              Beste Formation {best.formation} · {formatScore(best.score!, metric)}
            </Text>
          ) : (
            <>
              <Text style={styles.resultTextMuted}>Keine Formation besetzbar.</Text>
              {result.ranking[0] && (
                <Text style={styles.resultTextMuted}>{missingLabel(result.ranking[0].missing)}</Text>
              )}
            </>
          )}
        </View>
      </View>

      {metric === 'valuePerMillion' && (
        <Text style={styles.hint}>Maximiert Effizienz, nicht Punkte — die Elf ist bewusst günstig.</Text>
      )}

      {appliedDiff && (
        <View style={styles.diffRow}>
          <Text style={styles.diffText}>
            {appliedDiff.changeCount > 0
              ? `${appliedDiff.changeCount} Wechsel gegenüber deiner Elf.`
              : 'Keine Änderung — deine Elf ist bereits optimal.'}
          </Text>
          <Pressable style={styles.resetButton} onPress={onReset}>
            <Text style={styles.resetButtonText}>Zurücksetzen</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function missingLabel(missing: Partial<Record<Position, number>>): string {
  const parts = (Object.keys(missing) as (keyof typeof missing)[]).map(
    (position) => `${missing[position]} ${positionLabels[position]}`,
  );
  return parts.length > 0 ? `Es fehlen ${parts.join(', ')}.` : '';
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  metricChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  metricChipTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  applyButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
  resultInfo: {
    flex: 1,
  },
  resultText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  resultTextMuted: {
    ...typography.caption,
    color: colors.textMuted,
  },
  hint: {
    ...typography.small,
    color: colors.textMuted,
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  diffText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  resetButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButtonText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
