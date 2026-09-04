import type { TabIconProps } from './types';

/**
 * Drei Punkte für den Mehr-Tab. Waagerecht statt senkrecht: senkrechte Punkte
 * lesen sich als Overflow-Menü einer Zeile, waagerechte als eigener Bereich —
 * und genau das ist der Tab.
 */
export function MoreIcon({ color = 'currentColor', size = 24 }: TabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx={5} cy={12} r={1.9} fill={color} />
      <circle cx={12} cy={12} r={1.9} fill={color} />
      <circle cx={19} cy={12} r={1.9} fill={color} />
    </svg>
  );
}
