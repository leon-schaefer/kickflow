import type { TabIconProps } from './types';

/**
 * Drei senkrechte Punkte — das Überlaufmenü eines Browsers, wie es Chrome und
 * Firefox auf Android oben rechts tragen. Gegenstück zum waagerechten
 * `MoreIcon`, das den Mehr-TAB dieser App meint; die Richtung ist hier die
 * ganze Unterscheidung und deshalb ein eigenes Symbol.
 */
export function MenuIcon({ color = 'currentColor', size = 16 }: TabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx={12} cy={5} r={1.9} fill={color} />
      <circle cx={12} cy={12} r={1.9} fill={color} />
      <circle cx={12} cy={19} r={1.9} fill={color} />
    </svg>
  );
}
