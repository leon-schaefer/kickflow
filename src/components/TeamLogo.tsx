import { Image, Platform, StyleSheet, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { colors, radius } from '@/theme/tokens';

interface TeamLogoProps {
  uri: string | null;
  size?: number;
}

/** `logo.svg`, auch mit Query/Fragment dahinter. */
function isSvg(uri: string): boolean {
  return /\.svg($|[?#])/i.test(uri);
}

/**
 * Vereinslogo. Kickbase liefert die meisten Logos als SVG, `<Image>` kann das
 * auf iOS/Android nicht rendern — dafür `SvgUri` aus react-native-svg.
 *
 * Zwei Fälle, in denen `SvgUri` aber nichts anzeigt und deshalb `<Image>`
 * übernimmt:
 *   - Die URL ist gar keine SVG (PNG/JPG kommen ebenfalls vor). `SvgUri` würde
 *     versuchen, die Datei als XML zu parsen, und still leer bleiben.
 *   - Im Web. `SvgUri` lädt die Datei per fetch() und braucht dafür
 *     CORS-Header vom CDN; ein <img> (was `<Image>` auf react-native-web wird)
 *     braucht das nicht und rendert SVGs sowieso selbst.
 *
 * Ohne URL (unbekannter Gegner) ein leerer Platzhalter, damit die Zeile nicht springt.
 */
export function TeamLogo({ uri, size = 20 }: TeamLogoProps) {
  if (!uri) {
    return <View style={[styles.placeholder, { width: size, height: size }]} />;
  }

  const image = <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" />;
  if (Platform.OS === 'web' || !isSvg(uri)) return image;

  // `fallback` greift, wenn der Download/das Parsen scheitert — dann lieber das
  // Bild probieren als eine leere Lücke stehen zu lassen.
  return <SvgUri uri={uri} width={size} height={size} fallback={image} onError={() => {}} />;
}

const styles = StyleSheet.create({
  placeholder: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
});
