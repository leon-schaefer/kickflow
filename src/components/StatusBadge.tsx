import { statusLabels, statusShowsBadge } from '@/theme/tokens';
import type { PlayerStatus } from '@/api/kickbase';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
  status: PlayerStatus;
  size?: number;
  /** Überschreibt die Statusfarbe — für Punkte auf farbigem Grund (siehe PlayerCard). */
  color?: string;
}

/**
 * Status als Farbpunkt statt Text-Tag — auf einen Blick unterscheidbar, ohne
 * dass die Zeile je nach Statuslänge („Aufbautraining" vs. „Fit")
 * unterschiedlich breit wird.
 *
 * Vorher lief das über `SymbolView` aus expo-symbols mit SF-Symbols bzw.
 * Material Symbols und einem Farbpunkt als `fallback`. Auf Web waren die
 * Symbol-Fonts nie geladen, es rendert dort also seit immer genau dieser
 * Punkt — der Port ist damit pixelgleich und beseitigt zugleich eine
 * Abhängigkeit, die nicht einmal in der package.json stand.
 *
 * `role="img"` mit Label: der Punkt trägt eine Bedeutung, die sonst nur
 * farblich vorliegt.
 */
export function StatusBadge({ status, size = 16, color }: StatusBadgeProps) {
  if (!statusShowsBadge(status)) return null;

  return (
    <span
      role="img"
      aria-label={statusLabels[status]}
      className={styles.dot}
      data-status={status}
      style={{
        // Größe kommt aus dem Aufrufer, die Farbe nur wenn sie überschrieben
        // wird — sonst erbt sie über data-status aus theme/positions.css.
        '--badge-size': `${size}px`,
        ...(color ? { '--badge-color': color } : {}),
      } as React.CSSProperties}
    />
  );
}
