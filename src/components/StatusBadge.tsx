import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';
import type { PlayerStatus } from '@/api/kickbase';
import { statusColors, statusIcons, statusLabels } from '@/theme/tokens';

interface StatusBadgeProps {
  status: PlayerStatus;
  size?: number;
}

/** Status als Icon statt Text-Tag — auf einen Blick unterscheidbar, ohne dass
 * die Zeile je nach Statuslänge ("Aufbautraining" vs. "Fit") unterschiedlich breit wird. */
export function StatusBadge({ status, size = 16 }: StatusBadgeProps) {
  const icon = statusIcons[status];
  if (!icon) return null;

  const color = statusColors[status];

  return (
    <SymbolView
      name={{ ios: icon.ios, android: icon.android, web: icon.android }}
      tintColor={color}
      size={size}
      style={{ width: size, height: size }}
      accessibilityLabel={statusLabels[status]}
      // Web hat keine Material-Symbols-Fonts geladen — dort reicht ein Farbpunkt.
      fallback={<View style={{ width: size / 2, height: size / 2, borderRadius: size / 2, backgroundColor: color }} />}
    />
  );
}
