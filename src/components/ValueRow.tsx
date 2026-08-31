import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlayerStatus, Position } from '@/api/kickbase';
import { colors, positionColors, positionLabels, radius, spacing, typography } from '@/theme/tokens';
import { formatCountdown, formatCurrency, formatValueScore } from '@/utils/format';
import { StatusBadge } from './StatusBadge';

/**
 * Minimale Feldmenge, die sowohl SquadPlayer als auch MarketPlayer erfüllen.
 * Die Gebots-Felder sind optional und nur im Transfermarkt-Segment gesetzt
 * (siehe `onBid` in ValueScreen) — im Kader-Segment bleibt die Zeile unverändert.
 */
export interface ValueRowPlayer {
  id: string;
  name: string;
  position: Position;
  status: PlayerStatus;
  imageUrl: string | null;
  marketValue: number;
  valueScoreAvg: number;
  valueScoreTotal: number;

  /** Angebotspreis des Verkäufers, kann von marketValue abweichen. */
  price?: number;
  offerCount?: number;
  expiresInSeconds?: number | null;
  ownOfferPrice?: number | null;
}

interface ValueRowProps {
  player: ValueRowPlayer;
  onPress?: (player: ValueRowPlayer) => void;
  /** Nur im Transfermarkt-Segment gesetzt — schaltet die Gebotslage + den Bieten-Button frei. */
  onBid?: (player: ValueRowPlayer) => void;
}

/** Zeile für die Wert-Übersicht: Ø- und Gesamt-Punkte/Mio nebeneinander, im Markt-Modus zusätzlich die Gebotslage. */
export function ValueRow({ player, onPress, onBid }: ValueRowProps) {
  const isMarket = onBid !== undefined;
  const priceDiffersFromMarketValue = isMarket && player.price !== undefined && player.price !== player.marketValue;
  const hasOwnOffer = player.ownOfferPrice != null;

  const offerCountLabel =
    player.offerCount && player.offerCount > 0
      ? `${player.offerCount} Gebot${player.offerCount === 1 ? '' : 'e'}`
      : null;
  const countdownLabel =
    player.expiresInSeconds != null ? formatCountdown(player.expiresInSeconds * 1000) : null;
  const metaLabel = [offerCountLabel, countdownLabel].filter(Boolean).join(' · ');

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
          <Text style={styles.marketValue}>
            {formatCurrency(isMarket && player.price !== undefined ? player.price : player.marketValue)}
          </Text>
          {priceDiffersFromMarketValue && (
            <Text style={styles.marketValueHint}>MW {formatCurrency(player.marketValue)}</Text>
          )}
          <StatusBadge status={player.status} />
        </View>
        {isMarket && metaLabel.length > 0 && (
          <Text style={styles.metaText} numberOfLines={1}>
            {metaLabel}
          </Text>
        )}
        {isMarket && hasOwnOffer && (
          <Text style={styles.ownOfferText} numberOfLines={1}>
            Mein Gebot {formatCurrency(player.ownOfferPrice!)}
          </Text>
        )}
      </View>

      <View style={styles.scores}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreValue}>{formatValueScore(player.valueScoreAvg)}</Text>
            <Text style={styles.scoreLabel}>Ø/Mio</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreValue}>{formatValueScore(player.valueScoreTotal)}</Text>
            <Text style={styles.scoreLabel}>Ges/Mio</Text>
          </View>
        </View>
        {isMarket && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onBid(player);
            }}
            hitSlop={spacing.sm}
            style={({ pressed }) => [styles.bidPill, hasOwnOffer && styles.bidPillActive, pressed && styles.bidPillPressed]}
          >
            <Text style={[styles.bidPillText, hasOwnOffer && styles.bidPillTextActive]}>
              {hasOwnOffer ? 'Ändern' : 'Bieten'}
            </Text>
          </Pressable>
        )}
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
  marketValueHint: {
    ...typography.small,
    color: colors.textMuted,
  },
  metaText: {
    ...typography.small,
    color: colors.textMuted,
  },
  ownOfferText: {
    ...typography.small,
    color: colors.accent,
    fontWeight: '600',
  },
  scores: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  scoreRow: {
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
  bidPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.accentMuted,
  },
  bidPillActive: {
    backgroundColor: colors.accent,
  },
  bidPillPressed: {
    opacity: 0.7,
  },
  bidPillText: {
    ...typography.small,
    color: colors.accent,
    fontWeight: '700',
  },
  bidPillTextActive: {
    color: colors.background,
  },
});
