import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlayerStatus, Position } from '@/api/kickbase';
import { colors, positionColors, positionLabels, radius, spacing, typography } from '@/theme/tokens';
import { formatCurrency, formatValueScore } from '@/utils/format';
import { StatusBadge } from './StatusBadge';

/** Minimale Feldmenge, die sowohl SquadPlayer als auch MarketPlayer erfüllen. */
export interface ValueRowPlayer {
  id: string;
  name: string;
  position: Position;
  status: PlayerStatus;
  imageUrl: string | null;
  marketValue: number;
  valueScoreAvg: number;
  valueScoreTotal: number;
}

interface ValueRowProps {
  player: ValueRowPlayer;
  onPress?: (player: ValueRowPlayer) => void;
}

/** Zeile für die Wert-Übersicht: Ø- und Gesamt-Punkte/Mio nebeneinander. */
export function ValueRow({ player, onPress }: ValueRowProps) {
  return (
    <Pressable
      onPress={() => onPress?.(player)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.positionTag, { backgroundColor: `${positionColors[player.position]}26` }]}>
        <Text style={[styles.positionText, { color: positionColors[player.position] }]}>
          {positionLabels[player.position]}
        </Text>
      </View>

      {player.imageUrl ? (
        <Image source={{ uri: player.imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imageFallback]} />
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {player.name}
        </Text>
        <View style={styles.subRow}>
          <Text style={styles.marketValue}>{formatCurrency(player.marketValue)}</Text>
          <StatusBadge status={player.status} />
        </View>
      </View>

      <View style={styles.scores}>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreValue}>{formatValueScore(player.valueScoreAvg)}</Text>
          <Text style={styles.scoreLabel}>Ø/Mio</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreValue}>{formatValueScore(player.valueScoreTotal)}</Text>
          <Text style={styles.scoreLabel}>Ges/Mio</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
  positionTag: {
    width: 36,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  positionText: {
    ...typography.small,
    fontWeight: '700',
  },
  image: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
  },
  imageFallback: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.body,
    color: colors.textPrimary,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  marketValue: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  scores: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  scoreItem: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '700',
  },
  scoreLabel: {
    ...typography.small,
    color: colors.textMuted,
  },
});
