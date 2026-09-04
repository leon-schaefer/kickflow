import type { TabIconProps } from './types';

/**
 * Spielfeld-Rahmen + Mittellinie + zwei Reihen Aufstellungs-Punkte.
 * Bewusst ohne Mittelkreis: bei ~24px würde er nur zwischen den Punktreihen
 * verrauschen, Rahmen + Linie + Punkte tragen die Spielfeld-Metapher allein.
 */
export function PitchIcon({ color = 'currentColor', size = 24 }: TabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x={3} y={2.5} width={18} height={19} rx={2} stroke={color} strokeWidth={1.6} fill="none" />
      <line x1={3} y1={12} x2={21} y2={12} stroke={color} strokeWidth={1.4} />
      {[8, 12, 16].flatMap((cx) =>
        [7, 17].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.2} fill={color} />),
      )}
    </svg>
  );
}
