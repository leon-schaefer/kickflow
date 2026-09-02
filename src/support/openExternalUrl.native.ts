import * as Linking from 'expo-linking';

/**
 * Native Implementierung: übergibt die URL dem System, das den
 * Standard-Browser öffnet. Die App bleibt im Hintergrund bestehen.
 *
 * expo-linking ist ohnehin Abhängigkeit; expo-web-browser käme nur für ein
 * In-App-Sheet dazu und lohnt für einen einzelnen Link nicht.
 *
 * Wirft, wenn kein Handler existiert — der Aufrufer fängt das ab.
 */
export async function openExternalUrl(url: string): Promise<void> {
  await Linking.openURL(url);
}
