import { DarkTheme, type NativeStackNavigationOptions, type Theme } from 'expo-router';
import { colors } from './tokens';

/**
 * Dunkles Navigation-Theme. `contentStyle`/`sceneStyle` in den einzelnen
 * Screens färben nur den Inhalt — der native `ScreenStack`-Container
 * dahinter (sichtbar während Push/Pop-Animation & Swipe-Back) übernimmt
 * sonst `DefaultTheme` (hell) von expo-router. Ohne diesen Provider blitzt
 * dieser Container während jeder Navigation weiß auf.
 */
export const navigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.danger,
  },
};

/** Gemeinsame Stack-screenOptions, damit Header/Content überall gleich eingefärbt sind. */
export const stackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.textPrimary,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};
