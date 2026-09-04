import styles from './Spinner.module.css';

interface SpinnerProps {
  /** Default: Akzentfarbe. `currentColor` erbt stattdessen vom Kontext. */
  color?: string;
  size?: number;
  /** Für Ladezustände, die eine ganze Fläche füllen. */
  fill?: boolean;
}

/**
 * Ersatz für RNs `ActivityIndicator`. Reines CSS, keine Bibliothek.
 *
 * `role="status"` statt eines stummen Kreises: Screenreader melden damit, dass
 * etwas lädt — das leistete der ActivityIndicator nicht.
 */
export function Spinner({ color, size = 24, fill = false }: SpinnerProps) {
  const ring = (
    <span
      className={styles.ring}
      style={{ '--spinner-size': `${size}px`, ...(color ? { '--spinner-color': color } : {}) } as React.CSSProperties}
    />
  );

  return (
    <span role="status" aria-label="Lädt" className={fill ? styles.fill : styles.inline}>
      {ring}
    </span>
  );
}
