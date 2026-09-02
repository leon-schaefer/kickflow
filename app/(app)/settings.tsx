import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Checkbox } from '@/components/Checkbox';
import { useNotificationPreferences } from '@/notifications/useNotificationPreferences';
import { useMarkInteractive } from '@/observe/useMarkInteractive';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type PermissionState = 'loading' | 'granted' | 'denied' | 'undetermined';

/**
 * Einstellungen: Benachrichtigungs-Schalter (nativ only, siehe unten) und der
 * bisher fehlende Logout — `logout()` existiert seit Anfang an in
 * AuthProvider, wurde aber von keinem Screen aufgerufen. Erreichbar über den
 * Footer von LeagueSwitcher.tsx.
 */
export default function SettingsScreen() {
  const { logout } = useAuth();
  const { preferences, setPreference, loaded } = useNotificationPreferences();
  const [permission, setPermission] = useState<PermissionState>('loading');
  const isWeb = Platform.OS === 'web';

  // Auf Web fehlt die Benachrichtigungs-Karte komplett, dort ist der Screen
  // sofort fertig; nativ erscheinen die Schalter erst mit `loaded`.
  useMarkInteractive(isWeb || loaded);

  useEffect(() => {
    if (isWeb) return;
    Notifications.getPermissionsAsync().then((result) => setPermission(toPermissionState(result.status)));
  }, [isWeb]);

  // Die Anfrage passiert bewusst NICHT automatisch beim Laden dieses Screens,
  // sondern erst wenn der Nutzer aktiv einen Schalter anstellt (siehe
  // useNotificationSync.ts) — hier wie dort dieselbe Begründung.
  async function enableIfNeeded(): Promise<boolean> {
    if (permission === 'granted') return true;
    const result = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true } });
    const next = toPermissionState(result.status);
    setPermission(next);
    return next === 'granted';
  }

  async function togglePreference(key: 'deadlineReminders' | 'bidExpiryReminders', value: boolean) {
    if (value) {
      const granted = await enableIfNeeded();
      if (!granted) return; // Schalter bleibt aus, wenn die Berechtigung verweigert wurde.
    }
    setPreference(key, value);
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <>
      <Stack.Title>Einstellungen</Stack.Title>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {!isWeb && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Benachrichtigungen</Text>

            {permission === 'denied' && (
              <Text style={styles.warningText}>
                Benachrichtigungen sind in den iOS/Android-Einstellungen für kickflow deaktiviert — dort erst
                erlauben, dann funktionieren die Schalter unten.
              </Text>
            )}

            {loaded && (
              <>
                <Checkbox
                  label="Aufstellungs-Deadline"
                  checked={preferences.deadlineReminders}
                  onChange={(value) => togglePreference('deadlineReminders', value)}
                  hint="Erinnerung 24 Std, 3 Std und 1 Std vor Ablauf der Aufstellungs-Deadline."
                />
                <Checkbox
                  label="Gebot läuft ab"
                  checked={preferences.bidExpiryReminders}
                  onChange={(value) => togglePreference('bidExpiryReminders', value)}
                  hint="Erinnerung 30 und 10 Minuten, bevor ein Listing ausläuft, auf das du geboten hast."
                />
              </>
            )}

            <Text style={styles.disclaimer}>
              Rein lokal geplant, kein Server, kein Push-Dienst — funktioniert nur, solange kickflow von Zeit zu Zeit
              geöffnet wird, und ist auf maximal 64 gleichzeitig wartende Erinnerungen begrenzt (iOS-Obergrenze).
            </Text>
          </View>
        )}

        {isWeb && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Benachrichtigungen</Text>
            <Text style={styles.disclaimer}>Auf Web/PWA nicht verfügbar — dafür bräuchte es einen eigenen Server.</Text>
          </View>
        )}

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Abmelden</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

function toPermissionState(status: Notifications.PermissionStatus): PermissionState {
  switch (status) {
    case Notifications.PermissionStatus.GRANTED:
      return 'granted';
    case Notifications.PermissionStatus.DENIED:
      return 'denied';
    default:
      return 'undetermined';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  warningText: {
    ...typography.caption,
    color: colors.danger,
  },
  disclaimer: {
    ...typography.small,
    color: colors.textMuted,
  },
  logoutButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  logoutButtonText: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '600',
  },
});
