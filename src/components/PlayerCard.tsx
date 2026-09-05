import type { SquadPlayer } from '@/api/kickbase';
import { formatPoints } from '@/utils/format';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './PlayerCard.module.css';
import { StatusBadge } from './StatusBadge';

interface PlayerCardProps {
  player: SquadPlayer;
  onClick?: (player: SquadPlayer) => void;
  /** Wird im Aufstellungs-Editier-Modus hervorgehoben (z. B. austauschbar). */
  highlighted?: boolean;
  /**
   * Vom Optimizer neu aufgestellt/degradiert — additiver Rahmen statt Füllung,
   * damit er nicht mit `highlighted` (Bank-Auswahl) kollidiert.
   */
  changed?: boolean;
}

/** Kompakte Spielerkarte fürs Spielfeld und die Bank. */
export function PlayerCard({
  player,
  onClick,
  highlighted = false,
  changed = false,
}: PlayerCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(player)}
      className={cx(
        layout.pressableV,
        styles.card,
        highlighted && styles.highlighted,
        changed && styles.changed,
      )}
    >
      <span className={styles.imageWrap}>
        {player.imageUrl ? (
          <img src={player.imageUrl} alt="" className={styles.image} loading="lazy" />
        ) : (
          <span className={cx(styles.image, styles.imageFallback)} />
        )}
        {player.status !== 'fit' && (
          // Der Ring nimmt seine Farbe aus data-status, seinen Rahmen aus
          // --card-bg (Rasen vs. Bank) und setzt --badge-color für den Punkt
          // darin — der erbt sie, ohne dass StatusBadge eine Farbe als Prop
          // bekommt. Vorher liefen alle drei Werte durch JavaScript, --card-bg
          // sogar als `backgroundColor`-Prop von außen.
          <span className={styles.statusRing} data-status={player.status}>
            <StatusBadge status={player.status} size={STATUS_ICON_SIZE} />
          </span>
        )}
        {player.isCaptain && (
          <span className={styles.captainBadge} aria-label="Kapitän" role="img">
            C
          </span>
        )}
      </span>
      <span className={styles.name}>{player.name}</span>
      <span className={styles.statsRow}>
        <span className={styles.positionDot} data-position={player.position} />
        <span className={styles.points}>{formatPoints(player.averagePoints)}</span>
      </span>
    </button>
  );
}

const STATUS_ICON_SIZE = 11;
