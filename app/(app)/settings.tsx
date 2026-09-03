import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { useMarkInteractive } from '@/observe/useMarkInteractive';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/**
 * Einstellungen: der Logout. `logout()` existiert seit Anfang an in
 * AuthProvider, wurde aber von keinem Screen aufgerufen. Erreichbar über den
 * Footer von LeagueSwitcher.tsx.
 *
 * Hier standen bis zum Web-only-Umbau auch die Benachrichtigungs-Schalter
 * (Aufstellungs-Deadline, ablaufendes Gebot). Die liefen über
 * expo-notifications und damit ausschließlich nativ — im Browser zeigte der
 * Screen an dieser Stelle nur "Auf Web/PWA nicht verfügbar". Ein Ersatz über
 * Web Push bräuchte einen eigenen Server, den kickflow nicht hat.
 */
export default function SettingsScreen() {
  const { logout } = useAuth();

  // Nichts zu laden: der Screen ist ab dem ersten Frame bedienbar.
  useMarkInteractive(true);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <>
      <Stack.Title>Einstellungen</Stack.Title>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Abmelden</Text>
        </Pressable>
      </ScrollView>
    </>
  );
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
