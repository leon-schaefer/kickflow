import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Position } from '@/api/kickbase';
import { colors, positionColors, positionLabels, radius, spacing, typography } from '@/theme/tokens';

interface PlayerRowFrameProps {
  position: Position;
  imageUrl: string | null;
  onPress?: () => void;
  /** Namenszeile + Meta-Zeile — screenspezifisch (Kader vs. Markt). */
  children: ReactNode;
  /** Rechter Slot, i. d. R. `<PlayerStatColumn>`. */
  right: ReactNode;
}

/**
 * Gemeinsame Geometrie einer Spieler-Zeile: Pressable, Positions-Tag, Avatar
 * und die flexible Info-Spalte. Bisher wortgleich zwischen der Kader- und der
 * Markt-Zeile dupliziert (`row`, `pressed`, `positionTag`, `positionText`,
 * `image`, `imageFallback`, `info`) — hier einmalig.
 */
export function PlayerRowFrame({ position, imageUrl, onPress, children, right }: PlayerRowFrameProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.positionTag, { backgroundColor: `${positionColors[position]}26` }]}>
        <Text style={[styles.positionText, { color: positionColors[position] }]}>
          {positionLabels[position]}
        </Text>
      </View>

      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imageFallback]} />
      )}

      <View style={styles.info}>{children}</View>

      {right}
    </Pressable>
  );
}

export interface StatCell {
  value: string;
  /** Kleines Label darunter, z. B. "Ø/Mio" oder "P/Min". Fehlt bei der Marktwert-Zelle. */
  label?: string;
  tone?: 'primary' | 'accent' | 'positive' | 'negative' | 'muted';
  /** Größere, fette Darstellung für die tragende Kennzahl der Zeile (z. B. der Score im Markt). */
  emphasis?: boolean;
}

const TONE_COLORS: Record<NonNullable<StatCell['tone']>, string> = {
  primary: colors.textPrimary,
  accent: colors.accent,
  positive: colors.positive,
  negative: colors.negative,
  muted: colors.textSecondary,
};

interface PlayerStatColumnProps {
  cells: readonly StatCell[];
  /** Bieten/Ändern-Pille im Markt — sonst leer. */
  footer?: ReactNode;
}

/** Rechte Statistik-Spalte einer Spieler-Zeile: gestapelte Zahl+Label-Paare, optional mit Footer (Markt-Button). */
export function PlayerStatColumn({ cells, footer }: PlayerStatColumnProps) {
  return (
    <View style={styles.stats}>
      {cells.map((cell, index) => (
        <View key={index} style={styles.statCell}>
          <Text
            style={[
              styles.statValue,
              cell.emphasis && styles.statValueEmphasis,
              cell.tone && { color: TONE_COLORS[cell.tone] },
            ]}
          >
            {cell.value}
          </Text>
          {cell.label && <Text style={styles.statLabel}>{cell.label}</Text>}
        </View>
      ))}
      {footer}
    </View>
  );
}

/** Einzug der Trennlinie = Positions-Tag + Avatar + Abstände — bisher in beiden Screens als Magic Number dupliziert. */
export const PLAYER_ROW_SEPARATOR_INSET = spacing.md + 36 + spacing.sm;

export function PlayerRowSeparator() {
  return <View style={styles.separator} />;
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
  stats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  statCell: {
    alignItems: 'flex-end',
  },
  statValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  statValueEmphasis: {
    ...typography.body,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.small,
    color: colors.textMuted,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: PLAYER_ROW_SEPARATOR_INSET,
  },
});
