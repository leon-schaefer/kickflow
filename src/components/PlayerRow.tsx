import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SquadPlayer } from '@/api/kickbase';
import { colors, positionColors, positionLabels, radius, spacing, typography } from '@/theme/tokens';
import { formatCurrency, formatDelta, formatPoints } from '@/utils/format';
import { StatusBadge } from './StatusBadge';

interface PlayerRowProps {
  player: SquadPlayer;
  onPress?: (player: SquadPlayer) => void;
}

/** Eine Zeile im Kader-Screen: Position, Bild, Name, Marktwert, Punkte, Status. */
export function PlayerRow({ player, onPress }: PlayerRowProps) {
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
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {player.name}
          </Text>
          {player.inLineup && <View style={styles.lineupDot} />}
        </View>
        <StatusBadge status={player.status} />
      </View>

      <View style={styles.stats}>
        <Text style={styles.marketValue}>{formatCurrency(player.marketValue)}</Text>
        {player.marketValueChangeToday !== 0 && (
          <Text
            style={[
              styles.delta,
              { color: player.marketValueChangeToday > 0 ? colors.positive : colors.negative },
            ]}
          >
            {formatDelta(player.marketValueChangeToday)}
          </Text>
        )}
        <Text style={styles.points}>Ø {formatPoints(player.averagePoints)}</Text>
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  lineupDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  stats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  marketValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  delta: {
    ...typography.small,
  },
  points: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
