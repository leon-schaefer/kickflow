import { SymbolView } from "expo-symbols";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { PlayerStatus, Position } from "@/api/kickbase";
import {
  colors,
  positionColors,
  positionLabels,
  radius,
  spacing,
  typography,
} from "@/theme/tokens";
import {
  formatCountdown,
  formatCurrency,
  formatMinutes,
  formatPercentDelta,
  formatPoints,
  formatPointsPerMinute,
  formatValueScore,
} from "@/utils/format";
import type { ValueSortKey } from "@/utils/marketList";
import { filteredScoreKey, marketMarkupPercent } from "@/utils/marketList";
import type { PlaytimeTotals } from "@/utils/playtime";
import { pointsPerMinute } from "@/utils/playtime";
import { StatusBadge } from "./StatusBadge";

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
  averagePoints: number;
  valueScoreAvg: number;
  valueScoreTotal: number;

  /** Angebotspreis des Verkäufers, kann von marketValue abweichen. */
  price?: number;
  expiresInSeconds?: number | null;
  ownOfferPrice?: number | null;
}

interface ValueRowProps {
  player: ValueRowPlayer;
  /**
   * Spielzeit-Aggregat der aktuellen Saison aus usePlaytimes(). Bewusst eine
   * eigene Prop und kein Feld auf ValueRowPlayer: die Minuten stammen nicht aus
   * der Kader-/Marktliste, sondern aus einem separaten Request pro Spieler.
   * `undefined` = lädt noch.
   */
  playtime?: PlaytimeTotals;
  onPress?: (player: ValueRowPlayer) => void;
  /** Nur im Transfermarkt-Segment gesetzt — schaltet die Gebotslage + den Bieten-Button frei. */
  onBid?: (player: ValueRowPlayer) => void;
  /** Nur im Transfermarkt-Segment gesetzt — bestimmt, welcher Score-Wert rechts oben steht. */
  sortKey?: ValueSortKey;
}

/** Zeile für die Wert-Übersicht: Ø-/Gesamt-Punkte pro Mio und Punkte pro Spielminute nebeneinander, im Markt-Modus zusätzlich die Gebotslage. */
export function ValueRow({
  player,
  playtime,
  onPress,
  onBid,
  sortKey,
}: ValueRowProps) {
  const isMarket = onBid !== undefined;
  // Der nackte Marktwert daneben wäre nur eine zweite Zahl ohne Aussage — der
  // Aufschlag sagt direkt, wie weit die Forderung darüber liegt.
  const markupPercent = isMarket
    ? marketMarkupPercent(player.price, player.marketValue)
    : null;
  const hasOwnOffer = player.ownOfferPrice != null;

  const countdownLabel =
    player.expiresInSeconds != null
      ? formatCountdown(player.expiresInSeconds * 1000)
      : null;

  // "—" statt eines Fake-"0,00": ohne Einsatzminuten gibt es kein sinnvolles
  // Verhältnis, und ein "0,00" wäre von echten 0 Punkten nicht zu unterscheiden.
  const perMinuteLabel =
    playtime && playtime.minutes > 0
      ? formatPointsPerMinute(
          pointsPerMinute(playtime.points, playtime.minutes),
        )
      : "—";

  const scoresByKey = {
    avg: { value: formatValueScore(player.valueScoreAvg), label: "Ø/Mio" },
    total: {
      value: formatValueScore(player.valueScoreTotal),
      label: "Ges/Mio",
    },
    perMinute: { value: perMinuteLabel, label: "P/Min" },
    points: { value: formatPoints(player.averagePoints), label: "Ø Punkte" },
  } as const;
  // Kader: immer die 3 Mio-Scores nebeneinander. Markt: nur der aktive
  // Sortier-Wert oben, darunter Ø-Punkte roh (unabhängig vom Marktwert) —
  // gestapelt statt in einer Reihe.
  const scoreKeys = isMarket
    ? ([filteredScoreKey(sortKey ?? "avg"), "points"] as const)
    : (["avg", "total", "perMinute"] as const);

  return (
    <Pressable
      onPress={() => onPress?.(player)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.positionTag,
          { backgroundColor: `${positionColors[player.position]}26` },
        ]}
      >
        <Text
          style={[
            styles.positionText,
            { color: positionColors[player.position] },
          ]}
        >
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
            {formatCurrency(
              isMarket && player.price !== undefined
                ? player.price
                : player.marketValue,
            )}
          </Text>
          {markupPercent !== null && (
            <Text
              style={[
                styles.markup,
                markupPercent < 0 && styles.markupDiscount,
              ]}
            >
              {formatPercentDelta(markupPercent)}
            </Text>
          )}
          {/* Spielzeit als Einordnung neben P/Min — 2,45 P/Min aus 8' ist Rauschen, aus 500' nicht. */}
          {playtime && (
            <Text style={styles.playtimeText}>
              {formatMinutes(playtime.minutes)}
            </Text>
          )}
          <StatusBadge status={player.status} /> 
        </View>
        {hasOwnOffer && (
          <View style={styles.ownOfferRow}>
            <SymbolView
              name={{ ios: "hammer.fill", android: "gavel", web: "gavel" }}
              tintColor={colors.accent}
              size={12}
              style={{ width: 12, height: 12 }}
              fallback={
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.accent,
                  }}
                />
              }
            />
            <Text style={styles.ownOfferText} numberOfLines={1}>
              {formatCurrency(player.ownOfferPrice!)}
            </Text>
          </View>
        )}
        {isMarket && countdownLabel && (
          <View style={styles.metaRow}>
            {countdownLabel && (
              <Text style={styles.metaText} numberOfLines={1}>
                {countdownLabel}
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.scores}>
        <View style={[styles.scoreRow, isMarket && styles.scoreColumn]}>
          {scoreKeys.map((key) => (
            <View key={key} style={styles.scoreItem}>
              <Text style={styles.scoreValue}>{scoresByKey[key].value}</Text>
              <Text style={styles.scoreLabel}>{scoresByKey[key].label}</Text>
            </View>
          ))}
        </View>
        {isMarket && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onBid(player);
            }}
            hitSlop={spacing.sm}
            style={({ pressed }) => [
              styles.bidPill,
              hasOwnOffer && styles.bidPillActive,
              pressed && styles.bidPillPressed,
            ]}
          >
            <Text
              style={[
                styles.bidPillText,
                hasOwnOffer && styles.bidPillTextActive,
              ]}
            >
              {hasOwnOffer ? "Ändern" : "Bieten"}
            </Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
  },
  positionText: {
    ...typography.small,
    fontWeight: "700",
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  marketValue: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  markup: {
    ...typography.small,
    color: colors.textMuted,
  },
  // Ein Aufschlag ist der Normalfall und bleibt unauffällig; unter Marktwert
  // gelistet ist selten und genau die Zeile, die man sehen will.
  markupDiscount: {
    color: colors.positive,
    fontWeight: "700",
  },
  playtimeText: {
    ...typography.small,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  metaText: {
    ...typography.small,
    color: colors.textMuted,
  },
  ownOfferRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ownOfferText: {
    ...typography.small,
    color: colors.accent,
    fontWeight: "600",
  },
  scores: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  scoreRow: {
    flexDirection: "row",
    // spacing.sm statt md: mit der dritten Spalte (P/Min) wird es sonst auf
    // 375-px-Geräten zu eng für den Spielernamen.
    gap: spacing.sm,
  },
  scoreColumn: {
    flexDirection: "column",
    gap: 2,
  },
  scoreItem: {
    alignItems: "flex-end",
    minWidth: 44,
  },
  scoreValue: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "700",
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
    fontWeight: "700",
  },
  bidPillTextActive: {
    color: colors.background,
  },
});
