import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlayerStatus, Position } from '@/api/kickbase';
import { colors, positionColors, positionLabels, radius, spacing, typography } from '@/theme/tokens';
import { formatCurrency } from '@/utils/format';
import { recommendationLabels, type SellAdvice, type SellRecommendation } from '@/utils/sellAdvice';
import { StatusBadge } from './StatusBadge';

/** Minimale Feldmenge — von SquadPlayer erfüllt. */
export interface SellAdviceRowPlayer {
  id: string;
  name: string;
  position: Position;
  status: PlayerStatus;
  imageUrl: string | null;
  marketValue: number;
}

interface SellAdviceRowProps {
  player: SellAdviceRowPlayer;
  advice: SellAdvice;
  onPress?: (player: SellAdviceRowPlayer) => void;
  /** Ohne Handler bleibt die Zeile wie bisher ohne Umschalter (siehe utils/sellAdvice.ts). */
  onToggleExcluded?: (player: SellAdviceRowPlayer) => void;
}

const RECOMMENDATION_COLORS: Record<SellRecommendation, string> = {
  pflichtverkauf: colors.danger,
  ausgeschlossen: colors.textSecondary,
  unverzichtbar: colors.accent,
  'effizienz-juwel': colors.accent,
  'punkte-garant': positionColors.GK,
  rotation: colors.textSecondary,
  beobachten: colors.textMuted,
  verkaufen: colors.danger,
  'nicht-einsatzbereit': colors.textMuted,
};

/** Zeile für die Kader-Empfehlung: Empfehlungs-Pill + Begründung statt Punkte/Mio-Vergleich. */
export function SellAdviceRow({ player, advice, onPress, onToggleExcluded }: SellAdviceRowProps) {
  const color = RECOMMENDATION_COLORS[advice.recommendation];
  // 'verkaufen' ist ebenfalls rot — zwei transluzente rote Pills wären nicht
  // unterscheidbar. Der Pflichtverkauf bekommt deshalb eine deckende Füllung.
  const urgent = advice.recommendation === 'pflichtverkauf';

  return (
    <Pressable
      onPress={() => onPress?.(player)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
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

        <View style={styles.badgeColumn}>
          <View style={[styles.badge, { backgroundColor: urgent ? color : `${color}26` }]}>
            <Text style={[styles.badgeText, { color: urgent ? colors.textPrimary : color }]}>
              {recommendationLabels[advice.recommendation]}
            </Text>
          </View>
          {onToggleExcluded && (
            // Eigenes Pressable INNERHALB der Zeile: die Zeile öffnet weiterhin
            // das Spieler-Detail, der Umschalter darf das nicht mitauslösen.
            // Das passiert von selbst — nativ gewinnt der innerste Responder,
            // und react-native-web stoppt im Pressable-onClick die Propagation.
            <Pressable
              onPress={() => onToggleExcluded(player)}
              accessibilityRole="button"
              accessibilityLabel={
                advice.excluded
                  ? `${player.name} wieder zum Verkauf freigeben`
                  : `${player.name} vom Verkauf ausschließen`
              }
              hitSlop={spacing.xs}
              style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
            >
              <Text style={[styles.toggleText, advice.excluded && styles.toggleTextActive]}>
                {advice.excluded ? '✓ ausgeschlossen' : 'ausschließen'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <Text style={styles.reason}>{advice.reason}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  toggle: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  togglePressed: {
    opacity: 0.6,
  },
  toggleText: {
    ...typography.small,
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  badgeText: {
    ...typography.small,
    fontWeight: '700',
  },
  reason: {
    ...typography.small,
    color: colors.textMuted,
    marginLeft: 36 + spacing.sm,
  },
});
