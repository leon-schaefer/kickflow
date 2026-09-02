import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Position } from '@/api/kickbase';
import { describeRule, type LineupRule } from '@/lineup/rules';
import type { OptimizerDiff } from '@/lineup/useLineupOptimizer';
import { colors, positionLabels, radius, spacing, typography } from '@/theme/tokens';
import { formatCurrency, formatPoints, formatValueScore } from '@/utils/format';
import type { OptimizationResult, OptimizerMetric } from '@/utils/lineupOptimizer';
import { Checkbox } from './Checkbox';

const METRIC_OPTIONS: { key: OptimizerMetric; label: string }[] = [
  { key: 'valuePerMillion', label: 'Ø-Punkte/Mio' },
  { key: 'points', label: 'Ø-Punkte' },
  { key: 'expectedPoints', label: 'Erwartete Punkte' },
];

interface OptimizerBarProps {
  metric: OptimizerMetric;
  onChangeMetric: (metric: OptimizerMetric) => void;
  result: OptimizationResult;
  /** Eingefroren zum Zeitpunkt des letzten "Optimieren" — null, solange noch nicht übernommen. */
  appliedDiff: OptimizerDiff | null;
  onApply: () => void;
  onReset: () => void;
  /** "Konto ausgleichen" — siehe useLineupOptimizer.sellPlan/utils/sellPlan.ts. */
  balanceBudget: boolean;
  onChangeBalanceBudget: (value: boolean) => void;
  /** Fehlbetrag aus useBudgetLimit — 0 oder negativ, wenn das Konto im Plus ist. */
  deficit: number;
  /** Liga-eigene Optimizer-Regeln, für die Zusammenfassungszeile und den Blocker-Hinweis. */
  rules: readonly LineupRule[];
  onOpenRules: () => void;
  /** Einmalig für diese Optimierung ignorieren, wenn eine Regel keine Elf mehr zulässt. */
  onIgnoreRule: (id: LineupRule['id']) => void;
  /** Regeln, die die aktuelle (manuell bearbeitete) Elf verletzen — informativ, der Optimizer bindet nur sich selbst. */
  draftViolations: readonly LineupRule[];
}

function formatScore(score: number, metric: OptimizerMetric): string {
  return metric === 'valuePerMillion' ? `Ø ${formatValueScore(score)} Pkt/Mio` : `Ø ${formatPoints(Math.round(score))} Pkt`;
}

/** Formationswahl + Zielmetrik + "Konto ausgleichen" für den Aufstellungs-Optimizer. Nur im Edit-Modus sichtbar. */
export function OptimizerBar({
  metric,
  onChangeMetric,
  result,
  appliedDiff,
  onApply,
  onReset,
  balanceBudget,
  onChangeBalanceBudget,
  deficit,
  rules,
  onOpenRules,
  onIgnoreRule,
  draftViolations,
}: OptimizerBarProps) {
  const { best } = result;
  const activeRules = rules.filter((rule) => rule.enabled);
  const blockedRules = rules.filter((rule) => result.blockedRuleIds.includes(rule.id));

  return (
    <View style={styles.container}>
      <Pressable style={styles.rulesRow} onPress={onOpenRules}>
        <Text style={styles.rulesText}>
          {activeRules.length > 0 ? `Regeln: ${activeRules.map(describeRule).join(', ')}` : 'Keine Regeln aktiv'}
        </Text>
        <Text style={styles.rulesChevron}>›</Text>
      </Pressable>

      <Checkbox
        label="Konto ausgleichen"
        checked={balanceBudget}
        onChange={onChangeBalanceBudget}
        disabled={deficit <= 0}
        hint={
          deficit <= 0
            ? 'Konto ist im Plus — kein Ausgleich nötig.'
            : `Kontostand ${formatCurrency(-deficit)} — bezieht nötige Verkäufe in die Optimierung ein.`
        }
      />

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
          ) : blockedRules.length === 0 ? (
            <>
              <Text style={styles.resultTextMuted}>Keine Formation besetzbar.</Text>
              {result.ranking[0] && (
                <Text style={styles.resultTextMuted}>{missingLabel(result.ranking[0].missing)}</Text>
              )}
            </>
          ) : null}
        </View>
      </View>

      {!best && blockedRules.length > 0 && (
        <View style={styles.blockerBox}>
          {blockedRules.map((rule) => (
            <View key={rule.id} style={styles.blockerRow}>
              <Text style={styles.blockerText}>⚠ Blockiert von: {describeRule(rule)}</Text>
              <Pressable style={styles.ignoreButton} onPress={() => onIgnoreRule(rule.id)}>
                <Text style={styles.ignoreButtonText}>Regel für diese Optimierung ignorieren</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {metric === 'valuePerMillion' && (
        <Text style={styles.hint}>Maximiert Effizienz, nicht Punkte — die Elf ist bewusst günstig.</Text>
      )}

      {metric === 'expectedPoints' && (
        <Text style={styles.hint}>
          Ø-Punkte gewichtet mit der Gegner-Härte der nächsten Spiele — Angreifer/Mittelfeld nach
          gegnerischer Abwehr, Abwehr/Torwart nach gegnerischem Angriff. Grobe Tendenz, kein
          kalibriertes Vorhersagemodell.
        </Text>
      )}

      {draftViolations.length > 0 && (
        <Text style={styles.violationHint}>
          Deine aktuelle Elf verletzt: {draftViolations.map(describeRule).join(', ')}
        </Text>
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
  rulesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rulesText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  rulesChevron: {
    ...typography.caption,
    color: colors.textMuted,
  },
  blockerBox: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  blockerRow: {
    gap: spacing.xs,
  },
  blockerText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
  },
  ignoreButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ignoreButtonText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  violationHint: {
    ...typography.small,
    color: colors.danger,
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
