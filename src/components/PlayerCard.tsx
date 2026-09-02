import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SquadPlayer } from '@/api/kickbase';
import { colors, positionColors, radius, spacing, statusColors, typography } from '@/theme/tokens';
import { formatPoints } from '@/utils/format';
import { StatusBadge } from './StatusBadge';

interface PlayerCardProps {
  player: SquadPlayer;
  onPress?: (player: SquadPlayer) => void;
  /** Wird im Aufstellungs-Editier-Modus hervorgehoben (z. B. austauschbar). */
  highlighted?: boolean;
  /**
   * Vom Optimizer neu aufgestellt/degradiert — additiver Rahmen statt Füllung,
   * damit er nicht mit `highlighted` (Bank-Auswahl) kollidiert.
   */
  changed?: boolean;
  /** Rahmenfarbe des Status-Punkts — muss zum Hintergrund passen (Rasen vs. Bank). */
  backgroundColor?: string;
}

/** Kompakte Spielerkarte fürs Spielfeld und die Bank. */
export function PlayerCard({
  player,
  onPress,
  highlighted = false,
  changed = false,
  backgroundColor = colors.surface,
}: PlayerCardProps) {
  return (
    <Pressable
      onPress={() => onPress?.(player)}
      style={({ pressed }) => [
        styles.card,
        highlighted && styles.highlighted,
        changed && styles.changed,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.imageWrap}>
        {player.imageUrl ? (
          <Image source={{ uri: player.imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imageFallback]} />
        )}
        {player.status !== 'fit' && (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColors[player.status], borderColor: backgroundColor },
            ]}
          >
            {/* Icon statt reinem Farbpunkt: Verletzt und Angeschlagen sind sonst
             * nur an der Farbe zu unterscheiden — auf 12 px kaum verlässlich. */}
            <StatusBadge status={player.status} size={STATUS_ICON_SIZE} color={colors.background} />
          </View>
        )}
        {player.isCaptain && (
          <View style={styles.captainBadge}>
            <Text style={styles.captainText}>C</Text>
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {player.name}
      </Text>
      <View style={styles.statsRow}>
        <View style={[styles.positionDot, { backgroundColor: positionColors[player.position] }]} />
        <Text style={styles.points}>{formatPoints(player.averagePoints)}</Text>
      </View>
    </Pressable>
  );
}

const CARD_WIDTH = 68;
/** Kreis um das Statusicon — knapp größer als der alte 12-px-Punkt, damit das Glyph lesbar bleibt. */
const STATUS_BADGE_SIZE = 18;
const STATUS_ICON_SIZE = 11;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    alignItems: 'center',
    padding: spacing.xs,
    borderRadius: radius.md,
  },
  highlighted: {
    backgroundColor: colors.accentMuted,
  },
  changed: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.7,
  },
  imageWrap: {
    width: 48,
    height: 48,
    marginBottom: spacing.xs,
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
  },
  imageFallback: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: STATUS_BADGE_SIZE,
    height: STATUS_BADGE_SIZE,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captainBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captainText: {
    ...typography.small,
    fontSize: 10,
    color: colors.background,
    fontWeight: '700',
  },
  name: {
    ...typography.small,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  positionDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  points: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
