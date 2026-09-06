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
import { OfferIcon } from './icons/OfferIcon';
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

  // Die zweite Zelle ordnet die erste ein: Ø Punkte sagen, ob eine hohe
  // Punkte/Mio-Zahl von Leistung oder nur von einem kleinen Marktwert kommt.
  // Sortiert der Screen selbst nach Ø Punkten, stehen sie schon oben — dann
  // treten die Gesamtpunkte an die Stelle, statt dieselbe Zahl zu doppeln.
  const contextMetric: PlayerMetric = metric === 'avgPoints' ? 'totalPoints' : 'avgPoints';

  const cells: StatCell[] = [
    {
      value: formatMetric(player, metric, playtime),
      label: metricLabels[metric].cell,
      tone: 'accent',
      emphasis: true,
    },
    {
      value: formatMetric(player, contextMetric, undefined),
      label: metricLabels[contextMetric].cell,
    },
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
            Vorher ein SymbolView (Hammer) mit einem Punkt als `fallback`. Auf
            Web waren die Symbol-Fonts nie geladen, es rendert dort also seit
            immer nur der Punkt — und der war von jedem anderen Punkt der Zeile
            nicht zu unterscheiden. Hier steht jetzt ein eigener Hammer.
          */}
          <OfferIcon size={13} />
          <span className={styles.ownOfferText}>{formatCurrency(player.ownOfferPrice!)}</span>
        </span>
      )}
      {countdownLabel && <span className={styles.metaText}>{countdownLabel}</span>}
    </PlayerRowFrame>
  );
}
