import type { TabIconProps } from './types';

/**
 * X zum Leeren eines Eingabefeldes (siehe TextField). Bewusst nur zwei Striche
 * ohne gefüllten Kreis: der Kreis müsste die Feldfarbe kennen, die je nach
 * Screen zwischen `surface` und `background` wechselt.
 */
export function ClearIcon({ color = 'currentColor', size = 16 }: TabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M6 6L18 18M18 6L6 18"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
