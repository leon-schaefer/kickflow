import type { TabIconProps } from './types';

/**
 * Kleine Rangliste (3 Balken absteigender Breite) für den Liga-Tab —
 * unterscheidet sich von SquadIcon (Listenzeilen gleicher Breite) dadurch,
 * dass die Balken selbst schon "Platzierung" andeuten.
 */
export function LeagueIcon({ color = 'currentColor', size = 24 }: TabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x={3} y={5} width={16} height={3.4} rx={1} fill={color} />
      <rect x={3} y={10.3} width={12} height={3.4} rx={1} fill={color} />
      <rect x={3} y={15.6} width={8} height={3.4} rx={1} fill={color} />
    </svg>
  );
}
