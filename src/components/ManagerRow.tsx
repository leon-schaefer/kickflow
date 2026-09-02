import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LeagueManager } from '@/api/kickbase';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatCurrency, formatPoints } from '@/utils/format';

interface ManagerRowProps {
  manager: LeagueManager;
  onPress?: (manager: LeagueManager) => void;
  /** Markiert die eigene Zeile — siehe LeagueScreen, kommt nicht immer zustande. */
  isSelf?: boolean;
}

/**
 * Eine Zeile der Liga-Tabelle: Platz, Name, Punkte, Teamwert. Führt in die
 * Aufstellung des Managers (siehe app/(app)/[leagueId]/manager/[managerId].tsx).
 */
export function ManagerRow({ manager, onPress, isSelf = false }: ManagerRowProps) {
  return (
    <Pressable
      onPress={() => onPress?.(manager)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.placement}>{manager.placement !== null ? `${manager.placement}.` : '—'}</Text>

      {manager.imageUrl ? (
        <Image source={{ uri: manager.imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imageFallback]} />
      )}

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {manager.name}
          </Text>
          {isSelf && (
            <View style={styles.selfTag}>
              <Text style={styles.selfText}>Du</Text>
            </View>
          )}
        </View>
        {manager.teamValue !== null && (
          <Text style={styles.teamValue}>{formatCurrency(manager.teamValue)}</Text>
        )}
      </View>

      <View style={styles.stats}>
        <Text style={styles.points}>
          {manager.seasonPoints !== null ? formatPoints(manager.seasonPoints) : '—'}
        </Text>
        <Text style={styles.pointsLabel}>
          {manager.matchdayPoints !== null ? `ST ${formatPoints(manager.matchdayPoints)}` : 'Punkte'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  placement: {
    ...typography.caption,
    color: colors.textMuted,
    width: 28,
    textAlign: 'right',
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
    minWidth: 0,
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
  selfTag: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
  },
  selfText: {
    ...typography.small,
    color: colors.accent,
    fontWeight: '700',
  },
  teamValue: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  stats: {
    alignItems: 'flex-end',
  },
  points: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  pointsLabel: {
    ...typography.small,
    color: colors.textMuted,
  },
});
