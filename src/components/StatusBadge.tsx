import { StyleSheet, Text, View } from 'react-native';
import type { PlayerStatus } from '@/api/kickbase';
import { radius, spacing, statusColors, statusLabels, typography } from '@/theme/tokens';

interface StatusBadgeProps {
  status: PlayerStatus;
  /** Nur der Farbpunkt, ohne Text — für enge Layouts wie die Pitch-Karte. */
  dotOnly?: boolean;
}

export function StatusBadge({ status, dotOnly = false }: StatusBadgeProps) {
  const color = statusColors[status];

  if (dotOnly) {
    if (status === 'fit') return null;
    return <View style={[styles.dot, { backgroundColor: color }]} />;
  }

  if (status === 'fit') return null;

  return (
    <View style={[styles.badge, { backgroundColor: `${color}26` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{statusLabels[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  label: {
    ...typography.small,
  },
});
