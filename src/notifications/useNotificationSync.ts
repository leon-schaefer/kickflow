import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { desiredNotifications, type NotificationSchedulerInput } from './scheduler';

/**
 * Seiteneffekt-Hälfte von scheduler.ts: gleicht geplante gegen gewünschte
 * lokale Benachrichtigungen ab (schedule/cancel). Web wird komplett
 * übersprungen — expo-notifications unterstützt dort keine lokalen
 * Benachrichtigungen (siehe docs.expo.dev/versions/v57.0.0/sdk/notifications).
 * Ohne erteilte Berechtigung wird ebenfalls nichts geplant; die Anfrage
 * selbst passiert bewusst NICHT hier, sondern explizit im Einstellungs-
 * Screen (app/(app)/settings.tsx), wenn ein Schalter erstmals aktiviert wird.
 *
 * `deadlineUpdatedAt`/`openBidsUpdatedAt` (z. B. `query.dataUpdatedAt`) sind
 * bewusst die Auslöser in den Dependencies, nicht `input.deadline`/
 * `input.openBids` selbst: die kommen aus `.data` und wären bei jedem Render
 * eine neue Objekt-/Array-Referenz, der Effekt liefe dann bei jedem Render
 * statt nur, wenn wirklich neue Daten da sind. Der Effekt bekommt trotzdem
 * immer den aktuellen `input`-Wert, weil die Closure bei jedem Aufruf neu
 * erzeugt wird — nur das AUSLÖSEN wird seltener, nicht die gelesenen Daten.
 */
export function useNotificationSync(
  input: NotificationSchedulerInput,
  deadlineUpdatedAt: number,
  openBidsUpdatedAt: number,
): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;

    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      const desired = desiredNotifications(input, Date.now());
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      if (cancelled) return;

      const desiredById = new Map(desired.map((d) => [d.id, d]));
      const scheduledIds = new Set(scheduled.map((s) => s.identifier));

      // Überzählige zuerst canceln — sonst könnte eine veraltete Erinnerung
      // (z. B. für ein zurückgezogenes Gebot) kurzzeitig doppelt vorliegen.
      await Promise.all(
        scheduled
          .filter((s) => !desiredById.has(s.identifier))
          .map((s) => Notifications.cancelScheduledNotificationAsync(s.identifier)),
      );

      await Promise.all(
        desired
          .filter((d) => !scheduledIds.has(d.id))
          .map((d) =>
            Notifications.scheduleNotificationAsync({
              identifier: d.id,
              content: { title: d.title, body: d.body },
              trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(d.triggerAtMs) },
            }),
          ),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [deadlineUpdatedAt, openBidsUpdatedAt, input.preferences.deadlineReminders, input.preferences.bidExpiryReminders]);
}
