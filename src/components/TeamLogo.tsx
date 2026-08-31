import { StyleSheet, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { colors, radius } from '@/theme/tokens';

interface TeamLogoProps {
  uri: string | null;
  size?: number;
}

/**
 * Kickbase liefert Team-Logos als SVG — `<Image>` kann das nicht rendern,
 * deshalb `SvgUri` aus react-native-svg (lädt und parst die Remote-SVG selbst).
 * Ohne URL (unbekannter Gegner) ein leerer Platzhalter, damit die Zeile nicht springt.
 */
export function TeamLogo({ uri, size = 20 }: TeamLogoProps) {
  if (!uri) {
    return <View style={[styles.placeholder, { width: size, height: size }]} />;
  }
  return <SvgUri uri={uri} width={size} height={size} />;
}

const styles = StyleSheet.create({
  placeholder: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
});
