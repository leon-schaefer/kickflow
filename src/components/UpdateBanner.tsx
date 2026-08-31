import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/**
 * Web-only. `public/register-sw.js` vergleicht periodisch (Intervall +
 * Tab-Fokus) den Hash des geladenen JS-Bundles gegen den einer frisch vom
 * Server geholten index.html — siehe Kommentar dort, warum der reguläre
 * Service-Worker-Update-Lifecycle dafür nicht taugt. Sobald sie abweichen,
 * feuert es `kickflow:update-available` auf `window`.
 *
 * Reload passiert ausschließlich auf Tap, nie automatisch — ein Auto-Reload
 * könnte mitten in einer unges­pei­cherten Aufstellungsbearbeitung zuschlagen.
 */
export function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    function handleUpdate() {
      setUpdateAvailable(true);
    }
    window.addEventListener('kickflow:update-available', handleUpdate);
    return () => window.removeEventListener('kickflow:update-available', handleUpdate);
  }, []);

  if (!updateAvailable) return null;

  return (
    <Pressable
      style={[styles.banner, { top: insets.top + spacing.sm }]}
      onPress={() => window.location.reload()}
    >
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
