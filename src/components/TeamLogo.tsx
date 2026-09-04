import { Image, StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme/tokens';

interface TeamLogoProps {
  uri: string | null;
  size?: number;
}

/**
 * Vereinslogo. Kickbase liefert die meisten Logos als SVG, manche aber als
 * PNG/JPG — im Browser rendert `<Image>` (also ein `<img>`) beides selbst.
 *
 * Bewusst nicht `SvgUri` aus react-native-svg: das lädt die Datei per
 * `fetch()` und bräuchte dafür CORS-Header vom CDN, ein `<img>` nicht.
 *
 * Ohne URL (unbekannter Gegner) ein leerer Platzhalter, damit die Zeile nicht springt.
 */
export function TeamLogo({ uri, size = 20 }: TeamLogoProps) {
  if (!uri) {
    return <View style={[styles.placeholder, { width: size, height: size }]} />;
  }

  return <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  placeholder: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
});
