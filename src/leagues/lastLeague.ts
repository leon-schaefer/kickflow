import { LAST_LEAGUE_KEY } from '@/storage/keys';
import localStore from '@/storage/local';

/** Zuletzt gewählte Liga — nur für das "Zuletzt genutzt"-Badge im Picker, kein Auto-Resume. */
export function getLastLeagueId(): Promise<string | null> {
  return localStore.getItem(LAST_LEAGUE_KEY);
}

export function setLastLeagueId(id: string): Promise<void> {
  return localStore.setItem(LAST_LEAGUE_KEY, id);
}
