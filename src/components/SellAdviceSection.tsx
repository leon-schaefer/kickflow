import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SquadPlayer } from '@/api/kickbase';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatCurrency } from '@/utils/format';
import type { SellAdvice } from '@/utils/sellAdvice';
import type { SellPlan } from '@/utils/sellPlan';
import { SellAdviceRow } from './SellAdviceRow';

interface SellAdviceSectionProps {
  players: SquadPlayer[];
  advice: SellAdvice[];
  budget: number | null;
  /** Pflichtverkaufsplan bei negativem Konto — null, wenn das Konto im Plus ist. Siehe utils/sellPlan.ts. */
  plan: SellPlan | null;
  onSelectPlayer?: (player: SquadPlayer) => void;
  /** Spieler vom Verkauf ausschließen/freigeben — ohne Handler bleiben die Zeilen ohne Umschalter. */
  onToggleExcluded?: (player: SquadPlayer) => void;
}

/** "1 Pflichtverkauf" / "2 Pflichtverkäufe" — der Plural ändert hier den Stamm. */
function forcedLabel(count: number): string {
  return count === 1 ? '1 Pflichtverkauf' : `${count} Pflichtverkäufe`;
}

/**
 * Kaufen/Verkaufen-Einordnung des gesamten Kaders. Steht unabhängig vom
 * Edit-Modus zur Verfügung — die Analyse soll auch nach der Aufstellungs-
 * Deadline verfügbar sein. Standardmäßig zugeklappt, damit die Save-Bar im
 * Edit-Modus nicht aus dem Bild rutscht; die Kontoausgleichs-Zeile steht
 * deshalb in der Kopfzeile und nicht in der Liste.
 */
export function SellAdviceSection({
  players,
  advice,
  budget,
  plan,
  onSelectPlayer,
  onToggleExcluded,
}: SellAdviceSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const playersById = new Map(players.map((p) => [p.id, p]));

  // Bewusst weiter nur 'verkaufen': Pflichtverkäufe haben ihre eigene Zeile und
  // sollen den Zähler der sportlichen Verkaufskandidaten nicht still schrumpfen.
  // Ausgeschlossene tragen 'ausgeschlossen' und fallen damit von selbst heraus.
  const sellEntries = advice.filter((a) => a.recommendation === 'verkaufen');
  const tiedUpValue = sellEntries.reduce((sum, a) => sum + (playersById.get(a.playerId)?.marketValue ?? 0), 0);
  const excludedCount = advice.filter((a) => a.excluded).length;
  const forcedCount = plan?.sell.length ?? 0;
  const showBalanceLine = plan !== null && (forcedCount > 0 || !plan.feasible);

  // SellAdviceRow kennt nur die strukturelle SellAdviceRowPlayer-Teilmenge —
  // hier über die id wieder auf den vollständigen SquadPlayer auflösen.
  function handleSelect(id: string) {
    const player = playersById.get(id);
    if (player) onSelectPlayer?.(player);
  }

  function handleToggleExcluded(id: string) {
    const player = playersById.get(id);
    if (player) onToggleExcluded?.(player);
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={() => setExpanded((e) => !e)}>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            {expanded ? '▾' : '▸'} Kaufen & Verkaufen ({advice.length})
          </Text>
          {showBalanceLine && plan && (
            <Text style={plan.feasible ? styles.summary : styles.warning}>
              {plan.feasible
                ? `Kontoausgleich: ${forcedLabel(forcedCount)} · Erlös ${formatCurrency(plan.proceeds)} → Konto ${formatCurrency(plan.balanceAfter)}`
                : forcedCount > 0
                  ? `Kontoausgleich unvollständig: ${forcedLabel(forcedCount)} · es fehlen weiterhin ${formatCurrency(plan.shortfall)}`
                  : `Kontoausgleich nicht möglich — es fehlen ${formatCurrency(plan.shortfall)}.`}
            </Text>
          )}
          {/* Nur bei ungedecktem Fehlbetrag: dann ist der Ausschluss eine echte Ursache und keine Randnotiz. */}
          {showBalanceLine && plan && !plan.feasible && plan.excludedValue > 0 && (
            <Text style={styles.summary}>
              {formatCurrency(plan.excludedValue)} stecken in ausgeschlossenen Spielern — Ausschluss aufheben, um sie
              einzuplanen.
            </Text>
          )}
          <Text style={styles.summary}>
            {sellEntries.length === 0
              ? 'Keine Verkaufskandidaten'
              : `${sellEntries.length} Verkaufskandidat${sellEntries.length === 1 ? '' : 'en'} · ${formatCurrency(tiedUpValue)} gebunden`}
            {excludedCount > 0 && ` · ${excludedCount} ausgeschlossen`}
            {budget !== null && (
              <>
                {' · Budget '}
                <Text style={budget < 0 ? styles.budgetNegative : undefined}>{formatCurrency(budget)}</Text>
              </>
            )}
          </Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.list}>
          {/* Derselbe Vorbehalt wie in SellPlanBar — er gehört überall dorthin, wo Erlöse stehen. */}
          {forcedCount > 0 && (
            <Text style={styles.disclaimer}>
              Erlös geschätzt zum Marktwert — ein Verkauf an Mitspieler kann darüber liegen.
            </Text>
          )}
          {advice.map((entry, index) => {
            const player = playersById.get(entry.playerId);
            if (!player) return null;
            const isLast = index === advice.length - 1;
            return (
              <View key={entry.playerId} style={!isLast && styles.rowWrap}>
                <SellAdviceRow
                  player={player}
                  advice={entry}
                  onPress={(p) => handleSelect(p.id)}
                  onToggleExcluded={onToggleExcluded ? (p) => handleToggleExcluded(p.id) : undefined}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerText: {
    gap: 2,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  summary: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  budgetNegative: {
    color: colors.danger,
    fontWeight: '600',
  },
  warning: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
  },
  disclaimer: {
    ...typography.small,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
