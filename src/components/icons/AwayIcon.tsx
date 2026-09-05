import type { TabIconProps } from './types';

/**
 * Pfeil, der eine Kante verlässt — „Abwesend": nicht beim Verein, aber auch
 * nicht verletzt oder gesperrt.
 *
 * Kein durchgestrichener Kreis: der säße im Ring der PlayerCard als Kreis im
 * Kreis. Die stehende Kante links gibt dem Pfeil den Bezugspunkt, ohne den er
 * nur eine Richtung wäre.
 */
export function AwayIcon({ color = 'currentColor', size = 14 }: TabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4.5 3.5V20.5M9 12H20"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M15.5 7.5 20 12l-4.5 4.5"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
