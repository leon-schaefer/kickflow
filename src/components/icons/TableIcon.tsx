import Svg, { Rect } from 'react-native-svg';
import type { TabIconProps } from './types';

/**
 * Drei Balken aufsteigender Höhe = Tabelle/Rangliste für den Liga-Tab.
 * Bewusst kein Pokal: der Tab zeigt die ganze Tabelle, nicht nur die Spitze —
 * und ein Pokal wäre bei Tab-Größe kaum von einer Trophäen-Belohnung zu
 * unterscheiden.
 */
export function TableIcon({ color, size = 24 }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3.5} y={13} width={4.5} height={7.5} rx={1.2} fill={color} />
      <Rect x={9.75} y={8} width={4.5} height={12.5} rx={1.2} fill={color} />
      <Rect x={16} y={3.5} width={4.5} height={17} rx={1.2} fill={color} />
    </Svg>
  );
}
