import { Stack, useLocalSearchParams } from 'expo-router';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import { stackScreenOptions } from '@/theme/navigationTheme';

/**
 * Verschachtelt bewusst: (tabs) für Aufstellung/Kader als Bottom-Tabs,
 * player/[playerId] als normaler Stack-Screen darüber (mit Zurück-Button).
 * Ein Tab-Navigator allein kann keinen Detail-Screen mit Push-Transition
 * und automatischem Zurück-Pfeil anzeigen.
 */
export default function LeagueLayout() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();

  return (
    <LeagueIdProvider id={leagueId}>
      {/*
       * `key` erzwingt einen Remount des gesamten Subtrees bei Liga-Wechsel
       * (router.replace tauscht sonst nur den Param, Screens mit eigenem
       * Bearbeitungs-State wie lineup.tsx blieben sonst montiert — der
       * Entwurf der alten Liga würde sichtbar bleiben und könnte beim
       * Speichern an die falsche Liga gesendet werden).
       */}
      <Stack key={leagueId} screenOptions={stackScreenOptions}>
        {/*
         * `title` ist bei `headerShown: false` unsichtbar und dient nur als
         * Label-Quelle für den Zurück-Button darüberliegender Screens — ohne
         * ihn fällt der native Stack auf den Routennamen `(tabs)` zurück.
         */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Liga' }} />
        <Stack.Screen name="player/[playerId]" options={{ title: 'Spieler' }} />
        <Stack.Screen name="rules" options={{ title: 'Regeln' }} />
      </Stack>
    </LeagueIdProvider>
  );
}
