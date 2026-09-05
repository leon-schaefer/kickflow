import { LAST_LEAGUE_KEY } from '@/storage/keys';
import localStore from '@/storage/local';

/**
 * Zuletzt gewählte Liga — nur für das "Zuletzt genutzt"-Badge im Picker, kein
 * Auto-Resume.
 *
 * Synchron, anders als der Rest des Speichers: hier hängt keine
 * `loaded`-Semantik dran (Begründung in src/storage/local.ts), und der
 * Ligen-Picker liest den Wert im useState-Initializer. Über ein Promise
 * bräuchte er dafür einen Effect und ein zweites Rendern.
 */
export function getLastLeagueId(): string | null {
  return localStore.getItemSync(LAST_LEAGUE_KEY);
}

export function setLastLeagueId(id: string): Promise<void> {
  return localStore.setItem(LAST_LEAGUE_KEY, id);
}
