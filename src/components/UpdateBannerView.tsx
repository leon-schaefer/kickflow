import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/**
 * Rein präsentational, plattformunabhängig — wird von UpdateBanner.tsx
 * (nativ, expo-updates) und UpdateBanner.web.tsx (Service-Worker-Erkennung)
 * identisch verwendet, damit der Banner auf beiden Plattformen gleich aussieht.
 */
export function UpdateBannerView({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable style={[styles.banner, { top: insets.top + spacing.sm }]} onPress={onPress}>
      <Text style={styles.text}>Neue Version verfügbar — antippen zum Aktualisieren</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 1000,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  text: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '600',
    textAlign: 'center',
  },
});
