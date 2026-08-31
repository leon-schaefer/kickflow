import Svg, { Polyline } from 'react-native-svg';
import type { TabIconProps } from './types';

/**
 * Aufwärtstrend mit Pfeilspitze für den Wert-Tab (Punkte pro Mio).
 * Bewusst ohne Achsen — bei Tab-Größe ist der bloße Pfeilzug lesbarer.
 */
export function TrendIcon({ color, size = 24 }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polyline
        points="3,17 9,11 13,15 21,7"
        stroke={color}
        strokeWidth={1.9}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Polyline
        points="14.5,7 21,7 21,13.5"
        stroke={color}
        strokeWidth={1.9}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
