import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface ClearIconProps {
  color: ColorValue;
  size?: number;
}

/**
 * X zum Leeren eines Eingabefeldes (siehe TextField). Bewusst nur zwei Striche
 * ohne gefüllten Kreis: der Kreis müsste die Feldfarbe kennen, die je nach
 * Screen zwischen `surface` und `background` wechselt.
 */
export function ClearIcon({ color, size = 16 }: ClearIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 6L18 18M18 6L6 18"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
