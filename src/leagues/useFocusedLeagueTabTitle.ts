import { useNavigation } from 'expo-router';
import { focusedLeagueTabTitle, type TabsAwareState } from './leagueTabs';

/**
 * Zurück-Label für den Spieler-Detail-Screen: der Titel des Tabs, aus dem
 * heraus gepusht wurde. Nicht reaktiv — genügt: solange das Detail oben
 * liegt, wechselt kein Tab.
 */
export function useFocusedLeagueTabTitle(): string {
  return focusedLeagueTabTitle(useNavigation().getState() as TabsAwareState | undefined);
}
