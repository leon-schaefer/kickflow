import Svg, { Circle, Line } from 'react-native-svg';
import type { TabIconProps } from './types';

/**
 * Drei Listenzeilen mit Avatar-Punkt — unterscheidet sich dadurch von einem
 * generischen Listen-Icon und passt zur Spielerliste im Kader-Tab.
 */
export function SquadIcon({ color, size = 24 }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {[6.5, 12, 17.5].flatMap((y) => [
        <Circle key={`dot-${y}`} cx={5.5} cy={y} r={1.9} fill={color} />,
        <Line key={`line-${y}`} x1={10.5} y1={y} x2={20} y2={y} stroke={color} strokeWidth={1.8} strokeLinecap="round" />,
      ])}
    </Svg>
  );
}
