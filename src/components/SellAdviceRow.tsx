import type { PlayerStatus, Position } from '@/api/kickbase';
import { positionLabels } from '@/theme/tokens';
import { formatCurrency } from '@/utils/format';
import { recommendationLabels, type SellAdvice } from '@/utils/sellAdvice';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './SellAdviceRow.module.css';
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
  onClick?: (player: SellAdviceRowPlayer) => void;
  /** Ohne Handler bleibt die Zeile wie bisher ohne Umschalter (siehe utils/sellAdvice.ts). */
  onToggleExcluded?: (player: SellAdviceRowPlayer) => void;
}

/**
 * Zeile für die Kader-Empfehlung: Empfehlungs-Pill + Begründung statt
 * Punkte/Mio-Vergleich.
 *
 * Wie PlayerRowFrame ein `div role="button"` und kein `<button>`, weil der
 * Ausschluss-Umschalter darin liegt. Das `stopPropagation` dort war in der
 * RN-Fassung implizit (nativ gewinnt der innerste Responder, und
 * react-native-web stoppt die Propagation im Pressable-onClick); im DOM muss
 * es dastehen.
 *
 * Positions- und Empfehlungsfarbe kommen über `data-position` bzw.
 * `data-recommendation` aus theme/positions.css — vorher zwei
 * `${farbe}26`-Konkatenationen und eine RECOMMENDATION_COLORS-Map.
 */
export function SellAdviceRow({ player, advice, onClick, onToggleExcluded }: SellAdviceRowProps) {
  // 'verkaufen' ist ebenfalls rot — zwei transluzente rote Pills wären nicht
  // unterscheidbar. Der Pflichtverkauf bekommt deshalb eine deckende Füllung.
  const urgent = advice.recommendation === 'pflichtverkauf';

  return (
    <div
      className={styles.row}
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: () => onClick(player),
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick(player);
              }
            },
          }
        : {})}
    >
      <div className={styles.topRow}>
        <span className={styles.positionTag} data-position={player.position}>
          {positionLabels[player.position]}
        </span>

        {player.imageUrl ? (
          <img src={player.imageUrl} alt="" className={styles.image} loading="lazy" />
        ) : (
          <span className={cx(styles.image, styles.imageFallback)} />
        )}

        <span className={styles.info}>
          <span className={styles.name}>{player.name}</span>
          <span className={styles.subRow}>
            <span className={styles.marketValue}>{formatCurrency(player.marketValue)}</span>
            <StatusBadge status={player.status} />
          </span>
        </span>

        <span className={styles.badgeColumn}>
          <span
            className={cx(styles.badge, urgent && styles.badgeUrgent)}
            data-recommendation={advice.recommendation}
          >
            {recommendationLabels[advice.recommendation]}
          </span>
          {onToggleExcluded && (
            <button
              type="button"
              // Die Zeile öffnet das Spieler-Detail — der Umschalter darf das
              // nicht mitauslösen.
              onClick={(event) => {
                event.stopPropagation();
                onToggleExcluded(player);
              }}
              aria-pressed={advice.excluded}
              aria-label={
                advice.excluded
                  ? `${player.name} wieder zum Verkauf freigeben`
                  : `${player.name} vom Verkauf ausschließen`
              }
              className={cx(layout.pressable, layout.hitSlopSm, styles.toggle)}
            >
              {advice.excluded ? '✓ ausgeschlossen' : 'ausschließen'}
            </button>
          )}
        </span>
      </div>

      <p className={styles.reason}>{advice.reason}</p>
    </div>
  );
}
