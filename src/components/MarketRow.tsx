import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MarketPlayer } from "@/api/kickbase";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import {
  formatCountdown,
  formatCurrency,
  formatMinutes,
  formatPercentDelta,
} from "@/utils/format";
import { formatMetric, metricLabels, type PlayerMetric } from "@/utils/playerMetric";
import type { PlaytimeTotals } from "@/utils/playtime";
import type { StatCell } from "./PlayerRowFrame";
import { PlayerRowFrame, PlayerStatColumn } from "./PlayerRowFrame";
import { StatusBadge } from "./StatusBadge";
import { marketMarkupPercent } from "@/utils/marketList";

interface MarketRowProps {
  player: MarketPlayer;
  /** Spielzeit-Aggregat der aktuellen Saison aus usePlaytimes(); `undefined` = lädt (noch) nicht. */
  playtime?: PlaytimeTotals;
  /** Kennzahl unter dem Preis — folgt der aktiven Sortierung im Markt-Tab. */
  metric: PlayerMetric;
  onPress?: (player: MarketPlayer) => void;
  onBid: (player: MarketPlayer) => void;
}

/** Zeile für den Transfermarkt: Preis + Aufschlag auf den Marktwert, die aktive Wert-Kennzahl, Gebotslage. */
export function MarketRow({ player, playtime, metric, onPress, onBid }: MarketRowProps) {
  // Der nackte Marktwert daneben wäre nur eine zweite Zahl ohne Aussage — der
  // Aufschlag sagt direkt, wie weit die Forderung darüber liegt.
  const markupPercent = marketMarkupPercent(player.price, player.marketValue);
  const hasOwnOffer = player.ownOfferPrice != null;

  const countdownLabel =
    player.expiresInSeconds != null ? formatCountdown(player.expiresInSeconds * 1000) : null;

  const cells: StatCell[] = [
    { value: formatMetric(player, metric, playtime), label: metricLabels[metric].cell, tone: "accent", emphasis: true },
    { value: formatMetric(player, "avgPoints", undefined), label: metricLabels.avgPoints.cell },
  ];

  return (
    <PlayerRowFrame
      position={player.position}
      imageUrl={player.imageUrl}
      onPress={() => onPress?.(player)}
      right={
        <PlayerStatColumn
          cells={cells}
          footer={
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
              <Text style={[styles.bidPillText, hasOwnOffer && styles.bidPillTextActive]}>
                {hasOwnOffer ? "Ändern" : "Bieten"}
              </Text>
            </Pressable>
          }
        />
      }
    >
      <Text style={styles.name} numberOfLines={1}>
        {player.name}
      </Text>
      <View style={styles.subRow}>
        <Text style={styles.marketValue}>{formatCurrency(player.price)}</Text>
        {markupPercent !== null && (
          <Text style={[styles.markup, markupPercent < 0 && styles.markupDiscount]}>
            {formatPercentDelta(markupPercent)}
          </Text>
        )}
        {/* Spielzeit als Einordnung neben P/Min — 2,45 P/Min aus 8' ist Rauschen, aus 500' nicht. */}
        {playtime && <Text style={styles.playtimeText}>{formatMinutes(playtime.minutes)}</Text>}
        <StatusBadge status={player.status} />
      </View>
      {hasOwnOffer && (
        <View style={styles.ownOfferRow}>
          {/*
            Vorher ein SymbolView (Hammer) mit genau diesem Punkt als
            `fallback`. Auf Web waren die Symbol-Fonts nie geladen, es rendert
            dort also seit immer der Punkt — hier steht jetzt direkt er.
          */}
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
          <Text style={styles.ownOfferText} numberOfLines={1}>
            {formatCurrency(player.ownOfferPrice!)}
          </Text>
        </View>
      )}
      {countdownLabel && (
        <View style={styles.metaRow}>
          <Text style={styles.metaText} numberOfLines={1}>
            {countdownLabel}
          </Text>
        </View>
      )}
    </PlayerRowFrame>
  );
}

const styles = StyleSheet.create({
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
