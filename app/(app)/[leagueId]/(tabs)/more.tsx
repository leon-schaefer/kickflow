import Constants from 'expo-constants';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { LogoutButton } from '@/auth/LogoutButton';
import { ExternalLink } from '@/components/ExternalLink';
import { useMarkInteractive } from '@/observe/useMarkInteractive';
import { HOMEPAGE_URL, PRIVACY_URL } from '@/support/links';
import { openExternalUrl } from '@/support/openExternalUrl';
import { SUPPORT_URL } from '@/support/supportUrl';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/**
 * Letzter Tab neben Aufstellung/Spieler/Markt/Liga: alles, was nicht zur
 * Liga gehört.
 * Kartenaufbau folgt rules.tsx (surface + 1px border + radius.lg).
 *
 * Kein Refreshable/QueryState wie in den anderen Tabs — dieser Screen stellt
 * keine Kickbase-Anfrage, es gäbe nichts zu aktualisieren.
 */
export default function MoreScreen() {
  const { userName } = useAuth();
  const [linkFailed, setLinkFailed] = useState(false);
  const appVersion = Constants.expoConfig?.version;
  const gitSha = Constants.expoConfig?.extra?.gitSha;

  // Keine Kickbase-Anfrage auf diesem Tab: sofort bedienbar.
  useMarkInteractive(true);

  async function handleSupport() {
    if (!SUPPORT_URL) return;
    setLinkFailed(false);
    try {
      await openExternalUrl(SUPPORT_URL);
    } catch {
      setLinkFailed(true);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/*
       * Ohne EXPO_PUBLIC_SUPPORT_URL erscheint die Karte gar nicht — ein
       * Spenden-Button, der auf einen toten Link zeigt, ist schlechter als
       * keiner (siehe src/support/supportUrl.ts).
       */}
      {SUPPORT_URL && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>kickflow unterstützen</Text>
          <Text style={styles.cardBody}>
            kickflow ist kostenlos und bleibt es — Optimizer, Pflichtverkauf und Kaufempfehlungen
            inklusive. Wenn dir die App den Spieltag erleichtert, freue ich mich über
            Unterstützung bei der Weiterentwicklung. Freiwillig, einmalig, jederzeit.
          </Text>
          <Pressable style={styles.supportButton} onPress={handleSupport} accessibilityRole="button">
            <Text style={styles.supportButtonText}>Unterstützen</Text>
          </Pressable>
          <Text style={styles.hint}>Öffnet eine externe Seite. In kickflow ändert sich dadurch nichts.</Text>
          {linkFailed && <Text style={styles.error}>Die Seite konnte nicht geöffnet werden.</Text>}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Konto</Text>
        {/*
         * userName steht nur nach einem frischen Login zur Verfügung — der
         * AuthProvider stellt aus dem Store lediglich den Token wieder her.
         * Nach einem Neustart der App ist das Feld null, deshalb der Fallback.
         */}
        <Text style={styles.cardBody}>
          {userName ? `Angemeldet als ${userName}.` : 'Mit deinem Kickbase-Konto angemeldet.'}
        </Text>
        <LogoutButton />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Über kickflow</Text>
        <Text style={styles.cardBody}>
          Inoffizieller Begleiter für Kickbase. Nicht mit der Kickbase GmbH verbunden.
        </Text>
        {/*
         * Datenschutz muss aus der App heraus erreichbar sein (App-Store-
         * Review, DSGVO). Beide Seiten liegen auf codewithleon.dev — siehe
         * src/support/links.ts.
         */}
        <ExternalLink url={HOMEPAGE_URL} label="Homepage" />
        <ExternalLink url={PRIVACY_URL} label="Datenschutz" />
        {appVersion && (
          <Text style={styles.version}>
            Version {appVersion}
            {gitSha ? ` (${gitSha})` : ''}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  cardBody: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  supportButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  supportButtonText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
