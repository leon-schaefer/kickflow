import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SquadPlayer } from '@/api/kickbase';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatCurrency } from '@/utils/format';
import type { SellAdvice } from '@/utils/sellAdvice';
import { SellAdviceRow } from './SellAdviceRow';

interface SellAdviceSectionProps {
  players: SquadPlayer[];
  advice: SellAdvice[];
  budget: number | null;
  onSelectPlayer?: (player: SquadPlayer) => void;
}

/**
 * Kaufen/Verkaufen-Einordnung des gesamten Kaders. Steht unabhängig vom
 * Edit-Modus zur Verfügung — die Analyse soll auch nach der Aufstellungs-
 * Deadline verfügbar sein. Standardmäßig zugeklappt, damit die Save-Bar im
 * Edit-Modus nicht aus dem Bild rutscht.
 */
export function SellAdviceSection({ players, advice, budget, onSelectPlayer }: SellAdviceSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const playersById = new Map(players.map((p) => [p.id, p]));

  const sellEntries = advice.filter((a) => a.recommendation === 'verkaufen');
  const tiedUpValue = sellEntries.reduce((sum, a) => sum + (playersById.get(a.playerId)?.marketValue ?? 0), 0);

  // SellAdviceRow kennt nur die strukturelle SellAdviceRowPlayer-Teilmenge —
  // hier über die id wieder auf den vollständigen SquadPlayer auflösen.
  function handleSelect(id: string) {
    const player = playersById.get(id);
    if (player) onSelectPlayer?.(player);
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={() => setExpanded((e) => !e)}>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            {expanded ? '▾' : '▸'} Kaufen & Verkaufen ({advice.length})
          </Text>
          <Text style={styles.summary}>
            {sellEntries.length === 0
              ? 'Keine Verkaufskandidaten'
              : `${sellEntries.length} Verkaufskandidat${sellEntries.length === 1 ? '' : 'en'} · ${formatCurrency(tiedUpValue)} gebunden`}
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
          {advice.map((entry, index) => {
            const player = playersById.get(entry.playerId);
            if (!player) return null;
            const isLast = index === advice.length - 1;
            return (
              <View key={entry.playerId} style={!isLast && styles.rowWrap}>
                <SellAdviceRow player={player} advice={entry} onPress={(p) => handleSelect(p.id)} />
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
  list: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
