import type { KeyboardEvent, ReactNode } from 'react';
import type { Position } from '@/api/kickbase';
import { positionLabels } from '@/theme/tokens';
import { cx } from '@/utils/cx';
import styles from './PlayerRowFrame.module.css';

interface PlayerRowFrameProps {
  position: Position;
  imageUrl: string | null;
  onClick?: () => void;
  /** Namenszeile + Meta-Zeile — screenspezifisch (Kader vs. Markt). */
  children: ReactNode;
  /** Rechter Slot, i. d. R. `<PlayerStatColumn>`. */
  right: ReactNode;
}

/**
 * Gemeinsame Geometrie einer Spieler-Zeile: klickbare Zeile, Positions-Tag,
 * Avatar und die flexible Info-Spalte. Bisher wortgleich zwischen der Kader-
 * und der Markt-Zeile dupliziert — hier einmalig.
 *
 * Die Zeile ist ein `div` mit `role="button"` und nicht selbst ein `<button>`:
 * MarketRow schiebt eine Bieten-Pille in den rechten Slot, und ein Button darf
 * keinen Button enthalten. Das entspricht dem Pressable-in-Pressable der
 * React-Native-Fassung, inklusive des `stopPropagation` dort. Tastaturbedienung
 * kommt hier von Hand dazu — die hatte die alte Fassung auf Web nicht.
 *
 * Die Positionsfarbe kommt über `data-position` aus theme/positions.css. Damit
 * verschwindet die String-Konkatenation `${positionColors[position]}26`, die
 * sich in CSS nicht nachbauen ließe, und der Farbwert wandert nicht mehr durch
 * JavaScript.
 */
export function PlayerRowFrame({
  position,
  imageUrl,
  onClick,
  children,
  right,
}: PlayerRowFrameProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    // Ein echter Button macht das selbst; hier steht es von Hand, weil die
    // Zeile ein div sein muss.
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  }

  return (
    <div
      className={styles.row}
      data-position={position}
      {...(onClick
        ? { role: 'button', tabIndex: 0, onClick, onKeyDown: handleKeyDown }
        : {})}
    >
      <span className={styles.positionTag}>{positionLabels[position]}</span>

      {imageUrl ? (
        <img src={imageUrl} alt="" className={styles.image} loading="lazy" />
      ) : (
        <span className={cx(styles.image, styles.imageFallback)} />
      )}

      <span className={styles.info}>{children}</span>

      {right}
    </div>
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

interface PlayerStatColumnProps {
  cells: readonly StatCell[];
  /** Bieten/Ändern-Pille im Markt — sonst leer. */
  footer?: ReactNode;
}

/**
 * Rechte Statistik-Spalte einer Spieler-Zeile: gestapelte Zahl+Label-Paare,
 * optional mit Footer (Markt-Button).
 *
 * `tone` läuft über `data-tone` und theme/positions.css statt über eine
 * TONE_COLORS-Map in JavaScript.
 */
export function PlayerStatColumn({ cells, footer }: PlayerStatColumnProps) {
  return (
    <span className={styles.stats}>
      {cells.map((cell, index) => (
        <span key={index} className={styles.statCell}>
          <span
            className={cx(styles.statValue, cell.emphasis && styles.statValueEmphasis)}
            data-tone={cell.tone}
          >
            {cell.value}
          </span>
          {cell.label && <span className={styles.statLabel}>{cell.label}</span>}
        </span>
      ))}
      {footer}
    </span>
  );
}

/**
 * Einzug der Trennlinie = Positions-Tag + Avatar + Abstände.
 *
 * Bleibt als Komponente, solange die Listen noch `ItemSeparatorComponent`
 * benutzen; mit dem Port der Listen wird daraus ein `border-top` an der Zeile.
 */
export function PlayerRowSeparator() {
  return <span className={styles.separator} />;
}
