import { QueryClientProvider } from '@tanstack/react-query';
import { Observe, ObserveRoot } from 'expo-observe';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/auth/AuthProvider';
import { UpdateBanner } from '@/components/UpdateBanner';
import { queryClient } from '@/queries/queryClient';
import { navigationTheme, stackScreenOptions } from '@/theme/navigationTheme';
import { colors } from '@/theme/tokens';

/**
 * EAS Observe: die expo-router-Integration ergänzt die app-weiten
 * Start-Metriken um Werte PRO ROUTE (cold_ttr/warm_ttr/tti), sodass sich ein
 * langsamer Start einem konkreten Screen zuordnen lässt.
 *
 * Bewusst auf Modulebene und nicht in einer Komponente: `configure()` wirft,
 * sobald es nach dem ersten Screen-Mount läuft, und Integrationen lassen sich
 * zur Laufzeit nicht umschalten (siehe expo-observe/useObserve.ts).
 *
 * Die Routen dieser App tragen nur Kickbase-IDs (leagueId, playerId,
 * managerId) als Parameter — keine Zugangsdaten, keine E-Mail. Käme je ein
 * heikler Parameter dazu, gehört sein Name in `filteredParams`.
 */
Observe.configure({
  integrations: { 'expo-router': true },
});

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <ThemeProvider value={navigationTheme}>
              <Stack screenOptions={stackScreenOptions}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="(app)" options={{ headerShown: false }} />
              </Stack>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
        <UpdateBanner />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Startet die Messung von Cold/Warm-Launch und TTR (erster Frame). Muss die
// Wurzel-Komponente einwickeln, damit der Provider über allen Screens liegt.
export default ObserveRoot.wrap(RootLayout);
