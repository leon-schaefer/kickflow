import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_NOTIFICATION_PREFERENCES, parseStoredPreferences, type NotificationPreferences } from './preferences';

const STORAGE_KEY = 'kickflow.notifications.v1';

export interface NotificationPreferencesState {
  preferences: NotificationPreferences;
  setPreference: (key: keyof NotificationPreferences, value: boolean) => void;
  /** false, während die gespeicherten Einstellungen noch geladen werden — bis dahin gelten die Defaults. */
  loaded: boolean;
}

/**
 * Global statt pro Liga persistiert (anders als src/lineup/useLeagueRules.ts):
 * die Deadline-Erinnerung gilt für die zuletzt genutzte Liga, das Ein/Aus ist
 * aber eine App-weite Präferenz, kein Liga-Detail.
 */
export function useNotificationPreferences(): NotificationPreferencesState {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (cancelled) return;
      setPreferences(parseStoredPreferences(raw));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((key: keyof NotificationPreferences, value: boolean) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { preferences, setPreference, loaded };
}
