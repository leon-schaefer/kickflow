import type { MarketPlayer } from '@/api/kickbase';
import {
  formatCountdown,
  formatCurrency,
  formatMinutes,
  formatPercentDelta,
} from '@/utils/format';
import { marketMarkupPercent } from '@/utils/marketList';
import { formatMetric, metricLabels, type PlayerMetric } from '@/utils/playerMetric';
import type { PlaytimeTotals } from '@/utils/playtime';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './MarketRow.module.css';
import type { StatCell } from './PlayerRowFrame';
import { PlayerRowFrame, PlayerStatColumn } from './PlayerRowFrame';
import { StatusBadge } from './StatusBadge';

interface MarketRowProps {
  player: MarketPlayer;
  /** Spielzeit-Aggregat der aktuellen Saison aus usePlaytimes(); `undefined` = lädt (noch) nicht. */
  playtime?: PlaytimeTotals;
  /** Kennzahl unter dem Preis — folgt der aktiven Sortierung im Markt-Tab. */
  metric: PlayerMetric;
  onClick?: (player: MarketPlayer) => void;
  onBid: (player: MarketPlayer) => void;
}

/** Zeile für den Transfermarkt: Preis + Aufschlag auf den Marktwert, die aktive Wert-Kennzahl, Gebotslage. */
export function MarketRow({ player, playtime, metric, onClick, onBid }: MarketRowProps) {
  // Der nackte Marktwert daneben wäre nur eine zweite Zahl ohne Aussage — der
  // Aufschlag sagt direkt, wie weit die Forderung darüber liegt.
  const markupPercent = marketMarkupPercent(player.price, player.marketValue);
  const hasOwnOffer = player.ownOfferPrice != null;

  const countdownLabel =
    player.expiresInSeconds != null ? formatCountdown(player.expiresInSeconds * 1000) : null;

  const cells: StatCell[] = [
    {
      value: formatMetric(player, metric, playtime),
      label: metricLabels[metric].cell,
      tone: 'accent',
      emphasis: true,
    },
    { value: formatMetric(player, 'avgPoints', undefined), label: metricLabels.avgPoints.cell },
  ];

  return (
    <PlayerRowFrame
      position={player.position}
      imageUrl={player.imageUrl}
      onClick={onClick && (() => onClick(player))}
      right={
        <PlayerStatColumn
          cells={cells}
          footer={
            <button
              type="button"
              // Die Zeile darüber ist selbst klickbar (role="button") und würde
              // sonst zusätzlich das Spieler-Detail öffnen. Genau dasselbe
              // stopPropagation stand in der Pressable-Fassung.
              onClick={(event) => {
                event.stopPropagation();
                onBid(player);
              }}
              className={cx(
                layout.pressable,
                layout.hitSlop,
                styles.bidPill,
                hasOwnOffer && styles.bidPillActive,
              )}
            >
              {hasOwnOffer ? 'Ändern' : 'Bieten'}
            </button>
          }
        />
      }
    >
      <span className={styles.name}>{player.name}</span>
      <span className={styles.subRow}>
        <span className={styles.marketValue}>{formatCurrency(player.price)}</span>
        {markupPercent !== null && (
          <span className={cx(styles.markup, markupPercent < 0 && styles.markupDiscount)}>
            {formatPercentDelta(markupPercent)}
          </span>
        )}
        {/* Spielzeit als Einordnung neben P/Min — 2,45 P/Min aus 8' ist Rauschen, aus 500' nicht. */}
        {playtime && <span className={styles.playtimeText}>{formatMinutes(playtime.minutes)}</span>}
        <StatusBadge status={player.status} />
      </span>
      {hasOwnOffer && (
        <span className={styles.ownOfferRow}>
          {/*
            Vorher ein SymbolView (Hammer) mit genau diesem Punkt als
            `fallback`. Auf Web waren die Symbol-Fonts nie geladen, es rendert
            dort also seit immer der Punkt — hier steht jetzt direkt er.
          */}
          <span className={styles.ownOfferDot} />
          <span className={styles.ownOfferText}>{formatCurrency(player.ownOfferPrice!)}</span>
        </span>
      )}
      {countdownLabel && <span className={styles.metaText}>{countdownLabel}</span>}
    </PlayerRowFrame>
  );
}
