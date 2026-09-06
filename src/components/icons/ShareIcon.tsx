import type { TabIconProps } from './types';

/**
 * Das Teilen-Symbol aus iOS — Kasten mit Pfeil nach oben. Steht in der
 * Installations-Anleitung (src/pwa/) mitten im Text: „auf ⬆ tippen" findet
 * die Schaltfläche in der Safari-Leiste schneller als jede Beschreibung.
 *
 * Der Pfeil ragt bewusst über die obere Kante des Kastens hinaus, so wie bei
 * Apple; ein Pfeil im Kasten liest sich als Upload-Symbol.
 */
export function ShareIcon({ color = 'currentColor', size = 16 }: TabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3.2V14.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8.2 6.8 12 3l3.8 3.8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M7.5 10H6a1.8 1.8 0 0 0-1.8 1.8v7.4A1.8 1.8 0 0 0 6 21h12a1.8 1.8 0 0 0 1.8-1.8v-7.4A1.8 1.8 0 0 0 18 10h-1.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
