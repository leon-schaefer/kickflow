import type { TabIconProps } from './types';

/**
 * Fragezeichen für „Unbekannt" — Kickbase liefert für manche Spieler einen
 * Statuscode, den die Map nicht kennt (siehe mapStatus).
 *
 * Der Haken ist ein Bogen, kein Buchstabe: eine Textform würde je nach
 * Systemschrift anders aussehen als die übrigen Icons daneben.
 */
export function UnknownIcon({ color = 'currentColor', size = 14 }: TabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M7.8 8.8a4.3 4.3 0 1 1 4.2 5.2v1.4"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx={12} cy={19.4} r={1.8} fill={color} />
    </svg>
  );
}
