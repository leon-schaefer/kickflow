import type { ColorValue } from 'react-native';

export interface TabIconProps {
  /** Kommt von React Navigation: aktiv = accent, inaktiv = textMuted. */
  color: ColorValue;
  size?: number;
}
