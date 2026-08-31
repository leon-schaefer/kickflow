import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_LEAGUE_KEY = 'kickflow.lastLeagueId';

/** Zuletzt gewählte Liga — nur für das "Zuletzt genutzt"-Badge im Picker, kein Auto-Resume. */
export function getLastLeagueId(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_LEAGUE_KEY);
}

export function setLastLeagueId(id: string): Promise<void> {
  return AsyncStorage.setItem(LAST_LEAGUE_KEY, id);
}
