import { statusLabels, statusShowsBadge } from '@/theme/tokens';
import type { PlayerStatus } from '@/api/kickbase';
import { statusIcons } from './icons/statusIcons';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
  status: PlayerStatus;
  size?: number;
  /** Überschreibt die Statusfarbe — für Icons auf farbigem Grund (siehe PlayerCard). */
  color?: string;
}

/**
 * Status als Icon statt Text-Tag — auf einen Blick unterscheidbar, ohne dass
 * die Zeile je nach Statuslänge („Aufbautraining" vs. „Fit") unterschiedlich
 * breit wird.
 *
 * Vorher lief das über `SymbolView` aus expo-symbols mit SF-Symbols bzw.
 * Material Symbols und einem Farbpunkt als `fallback`. Auf Web waren die
 * Symbol-Fonts nie geladen, es rendert dort also nur je ein Punkt — sechs
 * Status, sechsmal derselbe Kreis, unterscheidbar allein an der Farbe (und
 * `injured`/`suspended` tragen dieselbe). Die Icons hier sind eigene SVGs
 * (`components/icons/statusIcons.tsx`) und brauchen keine Symbol-Font.
 *
 * `role="img"` mit Label: das Icon trägt eine Bedeutung, die sonst nur
 * grafisch vorliegt; das SVG darin ist `aria-hidden`.
 */
export function StatusBadge({ status, size = 14, color }: StatusBadgeProps) {
  if (!statusShowsBadge(status)) return null;

  const Icon = statusIcons[status];

  return (
    <span
      role="img"
      aria-label={statusLabels[status]}
      className={styles.badge}
      data-status={status}
      style={{
        // Größe kommt aus dem Aufrufer, die Farbe nur wenn sie überschrieben
        // wird — sonst erbt sie über data-status aus theme/positions.css.
        '--badge-size': `${size}px`,
        ...(color ? { '--badge-color': color } : {}),
      } as React.CSSProperties}
    >
      <Icon size={size} />
    </span>
  );
}
