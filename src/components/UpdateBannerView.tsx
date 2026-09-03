import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/**
 * Rein präsentational: der Banner selbst, ohne die Erkennung. Die steckt in
 * UpdateBanner.tsx, das auf das Event aus public/register-sw.js lauscht.
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
