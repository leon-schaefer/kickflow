import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { stackScreenOptions } from '@/theme/navigationTheme';
import { colors } from '@/theme/tokens';

export default function AppLayout() {
  const { token } = useAuth();

  // undefined = Session wird noch aus dem Store geladen (nicht dasselbe wie
  // null = kein Login!) — sonst wirft ein Reload mitten in der App den
  // Nutzer für einen Frame lang auf /login, bevor die Session geladen ist.
  if (token === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (token === null) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="leagues" options={{ title: 'Meine Ligen' }} />
      <Stack.Screen name="[leagueId]" options={{ headerShown: false }} />
    </Stack>
  );
}
