import type { TabIconProps } from './types';

/**
 * Kreispfeil für „Aufbautraining" — auf dem Weg zurück, noch nicht da.
 *
 * Bewusst keine Hantel: die läge bei 12 px als waagerechter Balken vor und
 * wäre von „Abwesend" (Pfeil) kaum zu unterscheiden. Der offene Kreis ist
 * schon an der Silhouette erkennbar, auch wenn die Pfeilspitze verschwimmt.
 */
export function RehabIcon({ color = 'currentColor', size = 14 }: TabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M16.8 6.25A7.5 7.5 0 1 1 9.45 4.95"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      {/* Pfeilspitze als gefülltes Dreieck statt als abgeknickter Strich: ein
          Strichwinkel verklumpt bei 12 px mit dem Bogenende zu einem Klecks. */}
      <path d="M11.6 4.1 9.5 7.4 7.9 3.0Z" fill={color} />
    </svg>
  );
}
