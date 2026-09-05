import type { TabIconProps } from './types';

/**
 * Aufwärtstrend mit Pfeilspitze für den Markt-Tab (Transfermarkt).
 * Bewusst ohne Achsen — bei Tab-Größe ist der bloße Pfeilzug lesbarer.
 */
export function TrendIcon({ color = 'currentColor', size = 24 }: TabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <polyline
        points="3,17 9,11 13,15 21,7"
        stroke={color}
        strokeWidth={1.9}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="14.5,7 21,7 21,13.5"
        stroke={color}
        strokeWidth={1.9}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
