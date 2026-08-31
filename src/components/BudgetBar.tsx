import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { BudgetLimit } from '@/utils/budget';
import { formatCurrency } from '@/utils/format';

interface BudgetBarProps {
  limit: BudgetLimit;
}

/**
 * Zeigt den 33%-Überziehungsrahmen (utils/budget.ts) über der Transfermarkt-
 * Liste: was für ein neues Gebot noch da ist, plus die Bestandteile, die
 * dahinterstecken (Kontostand, offene Gebote, Rahmen).
 */
export function BudgetBar({ limit }: BudgetBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Verfügbar</Text>
        <Text style={styles.value}>{formatCurrency(limit.available)}</Text>
      </View>
      <Text style={styles.detail}>
        Konto {formatCurrency(limit.budget)} · Rahmen {formatCurrency(limit.overdraftAllowance)}
        {limit.pendingOffers > 0 && ` · ${formatCurrency(limit.pendingOffers)} in offenen Geboten`}
      </Text>
      {limit.overLimit && (
        <Text style={styles.warning}>Kader bereits über der 33%-Grenze — Verkäufe nötig, bevor neue Gebote zählen.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  value: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  detail: {
    ...typography.small,
    color: colors.textMuted,
  },
  warning: {
    ...typography.small,
    color: colors.danger,
    fontWeight: '600',
    marginTop: 2,
  },
});
