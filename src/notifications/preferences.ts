import { z } from 'zod';

/**
 * Ein-/Aus-Schalter für die beiden Alarm-Typen (siehe scheduler.ts). Lokal pro
 * Gerät persistiert — es gibt dafür keinen Kickbase-Endpoint und keinen
 * eigenen Server. Vorbild: src/lineup/rules.ts (gleiches Schema-plus-Default-
 * Muster, dort pro Liga statt global).
 */
export interface NotificationPreferences {
  /** Erinnerungen vor der Aufstellungs-Deadline (T-24h/T-3h/T-1h). */
  deadlineReminders: boolean;
  /** Erinnerungen bevor ein eigenes Gebot ausläuft (T-30min/T-10min). */
  bidExpiryReminders: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  deadlineReminders: true,
  bidExpiryReminders: true,
};

const notificationPreferencesSchema = z.object({
  deadlineReminders: z.boolean(),
  bidExpiryReminders: z.boolean(),
});

/** Liest gespeicherte Einstellungen; bei fehlendem/kaputtem Wert die Defaults statt eines Crashs. */
export function parseStoredPreferences(raw: string | null): NotificationPreferences {
  if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const parsed = notificationPreferencesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_NOTIFICATION_PREFERENCES;
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}
