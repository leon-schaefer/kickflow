import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { colors } from '@/theme/tokens';
import { UpdateBannerView } from './UpdateBannerView';

/**
 * Nativ: expo-updates prüft beim Start (checkAutomatically ON_LOAD) und lädt
 * wegen fallbackToCacheTimeout 0 im Hintergrund — aktiv würde das Update damit
 * erst beim *nächsten* Kaltstart. Damit ein Fix nicht zwei Starts braucht,
 * zeigen wir denselben Banner wie im Web und rufen erst bei Tap reloadAsync().
 *
 * Reload passiert also ausschließlich auf Tap, nie automatisch — derselbe Grund
 * wie in UpdateBanner.web.tsx: ein Auto-Reload könnte mitten in einer
 * ungespeicherten Aufstellungsbearbeitung zuschlagen.
 *
 * Zusätzlich beim Wechsel in den Vordergrund erneut prüfen — das Pendant zum
 * visibilitychange-Handler in public/register-sw.js. Kein 30-Minuten-Intervall
 * wie dort: eine im Hintergrund liegende App bekommt ohnehin keinen Tap.
 */
export function UpdateBanner() {
  const { isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (!Updates.isEnabled) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkForUpdate();
    });
    return () => subscription.remove();
  }, []);

  if (!isUpdatePending) return null;
  return <UpdateBannerView onPress={reload} />;
}

function reload() {
  // Dunkler Reload-Screen statt Weiß-Blitz zwischen den Bundles — passt zum
  // dunklen Theme der App (siehe app.json backgroundColor).
  void Updates.reloadAsync({
    reloadScreenOptions: {
      backgroundColor: colors.background,
      fade: true,
      spinner: { enabled: true, color: colors.accent },
    },
  });
}

async function checkForUpdate() {
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // Offline oder Update-Server nicht erreichbar — beim nächsten
    // Vordergrund-Wechsel erneut versuchen. Bewusst still, wie der
    // .catch(() => {}) in public/register-sw.js.
  }
}
