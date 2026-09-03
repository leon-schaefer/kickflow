import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { openExternalUrl } from '@/support/openExternalUrl';
import { colors, spacing, typography } from '@/theme/tokens';

interface ExternalLinkProps {
  url: string;
  label: string;
  /** Kompakt = Fußzeile (Login), sonst Kartenzeile mit 44px Trefferfläche. */
  compact?: boolean;
}

/**
 * Textlink auf eine Seite außerhalb der App (Homepage, Datenschutz).
 *
 * Kein `<a href>`: derselbe Code läuft auf iOS/Android, wo es kein Anchor-
 * Element gibt. `openExternalUrl` löst das plattformweise auf — neuer Tab im
 * Web (die PWA läuft standalone und hätte sonst keinen Zurück-Weg), System-
 * Browser auf nativ (siehe src/support/openExternalUrl.web.ts / .native.ts).
 *
 * Der Fehlerzustand hängt am Link und nicht am Screen: auf nativ wirft
 * `Linking.openURL`, wenn kein Handler existiert, und dann soll die Meldung
 * unter dem angetippten Link stehen und nicht irgendwo auf der Karte.
 */
export function ExternalLink({ url, label, compact = false }: ExternalLinkProps) {
  const [failed, setFailed] = useState(false);

  async function handlePress() {
    setFailed(false);
    try {
      await openExternalUrl(url);
    } catch {
      setFailed(true);
    }
  }

  return (
    <View>
      <Pressable
        style={compact ? styles.compact : styles.full}
        onPress={handlePress}
        // `link` statt `button`: VoiceOver/TalkBack kündigen damit an, dass die
        // App verlassen wird.
        accessibilityRole="link"
        accessibilityLabel={label}
        hitSlop={compact ? spacing.sm : undefined}
      >
        <Text style={compact ? styles.compactText : styles.fullText}>{label}</Text>
      </Pressable>
      {failed && <Text style={styles.error}>Die Seite konnte nicht geöffnet werden.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    minHeight: 44,
    justifyContent: 'center',
  },
  fullText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
  compact: {
    minHeight: 32,
    justifyContent: 'center',
  },
  compactText: {
    ...typography.small,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
