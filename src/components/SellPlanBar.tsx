import { StyleSheet, Text, View } from 'react-native';
import type { SquadPlayer } from '@/api/kickbase';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatCurrency, formatPoints, formatValueScore } from '@/utils/format';
import type { OptimizerMetric } from '@/utils/lineupOptimizer';
import type { SellPlan } from '@/utils/sellPlan';

interface SellPlanBarProps {
  players: readonly SquadPlayer[];
  plan: SellPlan | null;
  metric: OptimizerMetric;
}

function formatScoreLoss(scoreLoss: number, metric: OptimizerMetric): string {
  if (scoreLoss <= 0) return 'ohne Punkteverlust';
  return metric === 'valuePerMillion'
    ? `−${formatValueScore(scoreLoss)} Pkt/Mio gegenüber der freien Elf`
    : `−${formatPoints(Math.round(scoreLoss))} Pkt gegenüber der freien Elf`;
}

/**
 * Ergebnis der "Konto ausgleichen"-Option (die Checkbox selbst sitzt in
 * OptimizerBar, bei den übrigen Optimierungs-Einstellungen). `plan` ist nur
 * gesetzt, wenn die Checkbox aktiv UND ein Defizit vorhanden ist
 * (useLineupOptimizer) — hier also keine eigene enabled/deficit-Prüfung nötig.
 */
export function SellPlanBar({ players, plan, metric }: SellPlanBarProps) {
  if (!plan) return null;

  const playersById = new Map(players.map((p) => [p.id, p]));

  return (
    <View style={styles.container}>
      {plan.sell.length > 0 && (
        <View style={styles.list}>
          {plan.sell.map((entry) => {
            const player = playersById.get(entry.playerId);
            return (
              <View key={entry.playerId} style={styles.row}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {player?.name ?? entry.playerId}
                </Text>
                <Text style={styles.rowValue}>{formatCurrency(entry.marketValue)}</Text>
                <Text style={styles.rowTag}>{entry.wasInBestXi ? 'aus der Elf' : 'Bank'}</Text>
              </View>
            );
          })}
        </View>
      )}

      {plan.feasible ? (
        <>
          <Text style={styles.summary}>
            Erlös {formatCurrency(plan.proceeds)} → Konto {formatCurrency(plan.balanceAfter)}
          </Text>
          <Text style={styles.hint}>Kosten: {formatScoreLoss(plan.scoreLoss, metric)}</Text>
        </>
      ) : plan.shortfall > 0 ? (
        <>
          <Text style={styles.warning}>Kader deckt den Fehlbetrag nicht — es fehlen {formatCurrency(plan.shortfall)}.</Text>
          {plan.excludedValue > 0 && (
            <Text style={styles.hint}>
              {plan.excludedCount === 1
                ? `1 ausgeschlossener Spieler mit ${formatCurrency(plan.excludedValue)} bleibt unangetastet.`
                : `${plan.excludedCount} ausgeschlossene Spieler mit ${formatCurrency(plan.excludedValue)} bleiben unangetastet.`}
            </Text>
          )}
        </>
      ) : (
        <Text style={styles.warning}>Nach den nötigen Verkäufen steht keine Elf mehr.</Text>
      )}

      <Text style={styles.disclaimer}>Erlös geschätzt zum Marktwert — ein Verkauf an Mitspieler kann darüber liegen.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowName: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
  },
  rowValue: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  rowTag: {
    ...typography.small,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  summary: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  hint: {
    ...typography.small,
    color: colors.textMuted,
  },
  warning: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
  },
  disclaimer: {
    ...typography.small,
    color: colors.textMuted,
  },
});
