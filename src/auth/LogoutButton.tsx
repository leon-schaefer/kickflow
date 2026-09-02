import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { useAuth } from './AuthProvider';

/** Nach dieser Zeit fällt ein scharfgestellter Button in den Normalzustand zurück. */
const CONFIRM_TIMEOUT_MS = 4000;

interface LogoutButtonProps {
  /** Kompakt = Textbutton für den Header der Ligenliste, sonst volle Kartenzeile. */
  compact?: boolean;
}

/**
 * Zweistufig statt `Alert.alert`: react-native-web implementiert `Alert` als
 * leere Methode (node_modules/react-native-web/dist/exports/Alert/index.js —
 * `static alert() {}`). Im Web, also in der PWA, käme nie ein Dialog; der
 * erste Tap würde entweder kommentarlos ausloggen oder gar nichts tun. Ein
 * zweiter Tap auf denselben Button verhält sich überall gleich und braucht
 * kein eigenes Modal.
 *
 * Nach dem Abmelden wird bewusst nicht navigiert: `logout()` setzt den Token
 * auf null, woraufhin app/(app)/_layout.tsx auf /login umleitet und diesen
 * Button ohnehin abbaut.
 */
export function LogoutButton({ compact = false }: LogoutButtonProps) {
  const { logout } = useAuth();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  async function handlePress() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    try {
      await logout();
    } catch {
      // clearSession() kann auf nativ scheitern (Keychain/Keystore). Ohne
      // Reset bliebe der Button dauerhaft im Ladezustand hängen.
      setBusy(false);
      setArmed(false);
    }
  }

  const label = armed ? 'Wirklich abmelden?' : 'Abmelden';

  return (
    <Pressable
      style={[
        compact ? styles.compact : styles.full,
        armed && !compact && styles.fullArmed,
        busy && styles.busy,
      ]}
      onPress={handlePress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? (
        <ActivityIndicator color={colors.danger} size="small" />
      ) : (
        <Text style={[compact ? styles.compactText : styles.fullText, armed && styles.textArmed]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  fullArmed: {
    borderColor: colors.danger,
  },
  fullText: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '600',
  },
  compact: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  compactText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
  },
  textArmed: {
    color: colors.danger,
  },
  busy: {
    opacity: 0.7,
  },
});
