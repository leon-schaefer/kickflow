import type { TabIconProps } from './types';

/**
 * Karte für „Gesperrt" — im Fußball die Ursache der Sperre und damit die
 * einzige Metapher, die ohne Text auskommt.
 *
 * Leicht gekippt (12°), weil eine gerade stehende Karte bei 12 px als
 * rechteckiger Klotz liest; die Schräge macht sie als Karte erkennbar.
 * Die Farbe kommt wie bei allen Statusicons von außen — im Rot der Sperre
 * ist es die rote Karte, im Ring der PlayerCard deren Gegenfarbe.
 */
export function SuspendedIcon({ color = 'currentColor', size = 14 }: TabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect
        x={7}
        y={3.5}
        width={10}
        height={15}
        rx={1.8}
        fill={color}
        transform="rotate(12 12 12)"
      />
    </svg>
  );
}
