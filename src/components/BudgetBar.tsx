import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { BudgetLimit } from '@/utils/budget';
import { formatCurrency } from '@/utils/format';

interface BudgetBarProps {
  limit: BudgetLimit;
}

/**
 * Zeigt den 33%-Überziehungsrahmen (utils/budget.ts) über der Transfermarkt-
 * Liste. Zugeklappt steht dort nur, was für ein neues Gebot noch da ist — die
 * Bestandteile dahinter (Kontostand, offene Gebote, Rahmen) kommen erst beim
 * Antippen dazu, damit die Zeile über der Liste nicht dauerhaft Platz kostet.
 * Die Überziehungs-Warnung bleibt auch zugeklappt stehen: ohne sie sähe ein
 * `available` von 0 € wie ein leeres Konto statt wie ein Verkaufszwang aus.
 */
export function BudgetBar({ limit }: BudgetBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.row}
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint={expanded ? 'Blendet die Details aus.' : 'Zeigt Konto, offene Gebote und Rahmen.'}
      >
        <Text style={styles.label}>Verfügbar</Text>
        <View style={styles.valueGroup}>
          <Text style={styles.value}>{formatCurrency(limit.available)}</Text>
          <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Konto</Text>
            <Text style={styles.detailValue}>{formatCurrency(limit.budget)}</Text>
          </View>
          {limit.pendingOffers > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>In offenen Geboten</Text>
              <Text style={styles.detailValue}>{formatCurrency(limit.pendingOffers)}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Rahmen</Text>
            <Text style={styles.detailValue}>{formatCurrency(limit.overdraftAllowance)}</Text>
          </View>
        </View>
      )}

      {limit.overLimit && (
        <Text style={styles.warning}>Kader bereits über der 33%-Grenze — Verkäufe nötig, bevor neue Gebote zählen.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
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
  valueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  value: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  chevron: {
    ...typography.caption,
    color: colors.textMuted,
  },
  details: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    ...typography.small,
    color: colors.textMuted,
  },
  detailValue: {
    ...typography.small,
    color: colors.textSecondary,
  },
  warning: {
    ...typography.small,
    color: colors.danger,
    fontWeight: '600',
    marginTop: 2,
  },
});
