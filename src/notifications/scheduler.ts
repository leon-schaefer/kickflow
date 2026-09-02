/**
 * Reine Herleitung "welche lokalen Benachrichtigungen sollten jetzt geplant
 * sein" — komplett ohne expo-notifications-Import, damit sie ohne Simulator/
 * Gerät testbar bleibt (Vorbild: resolveMatchdayState in utils/matchday.ts,
 * gleiche Trennung "Zeit wird injiziert, nicht gelesen"). Der Seiteneffekt
 * (tatsächlich planen/canceln) lebt in useNotificationSync.ts.
 *
 * Kein Server, kein Polling: beide Zeitpunkte (Deadline, Gebots-Ablauf) sind
 * bereits im Client bekannt, sobald die zugehörige Query aufgelöst hat.
 */
import { formatCountdown } from '@/utils/format';
import type { NotificationPreferences } from './preferences';

/** iOS erlaubt maximal 64 wartende lokale Benachrichtigungen — hart begrenzen, bevor überhaupt geplant wird. */
export const MAX_PENDING_NOTIFICATIONS = 64;

const DEADLINE_LEAD_TIMES_MS = [24 * 60 * 60_000, 3 * 60 * 60_000, 60 * 60_000] as const; // T-24h, T-3h, T-1h
const BID_LEAD_TIMES_MS = [30 * 60_000, 10 * 60_000] as const; // T-30min, T-10min

export interface DeadlineInfo {
  day: number;
  /** ISO-Zeitpunkt, siehe MatchdayState.open.deadline (utils/matchday.ts). */
  deadlineIso: string;
}

export interface OpenBid {
  playerId: string;
  playerName: string;
  /**
   * Restlaufzeit in Sekunden, so wie `MarketPlayer.expiresInSeconds` sie zum
   * Zeitpunkt `nowMs` (Parameter unten) geliefert hat — dieselbe Momentaufnahme,
   * die auch der Countdown in MarketRow.tsx anzeigt, kein Live-Timer.
   */
  expiresInSeconds: number;
}

export interface DesiredNotification {
  /** Stabile ID über mehrere Sync-Läufe hinweg — Basis für den Diff in useNotificationSync. */
  id: string;
  title: string;
  body: string;
  /** Absoluter Zeitpunkt (ms seit Epoch), zu dem die Benachrichtigung feuern soll. */
  triggerAtMs: number;
}

export interface NotificationSchedulerInput {
  deadline: DeadlineInfo | null;
  openBids: readonly OpenBid[];
  preferences: NotificationPreferences;
}

/**
 * Alle Benachrichtigungen, die JETZT (bezogen auf `nowMs`) geplant sein
 * sollten — bereits auf `MAX_PENDING_NOTIFICATIONS` begrenzt, nächste zuerst.
 * Bereits verstrichene Auslösezeitpunkte werden verworfen, nicht "sofort
 * nachgeholt" — eine Erinnerung nach der Deadline wäre nutzlos.
 */
export function desiredNotifications(input: NotificationSchedulerInput, nowMs: number): DesiredNotification[] {
  const result: DesiredNotification[] = [];

  if (input.preferences.deadlineReminders && input.deadline) {
    const deadlineMs = new Date(input.deadline.deadlineIso).getTime();
    if (Number.isFinite(deadlineMs)) {
      for (const lead of DEADLINE_LEAD_TIMES_MS) {
        const triggerAtMs = deadlineMs - lead;
        if (triggerAtMs <= nowMs) continue;
        result.push({
          id: `deadline-${input.deadline.day}-${lead}`,
          title: `Aufstellung für Spieltag ${input.deadline.day}`,
          body: `Deadline in ${formatCountdown(lead)}.`,
          triggerAtMs,
        });
      }
    }
  }

  if (input.preferences.bidExpiryReminders) {
    for (const bid of input.openBids) {
      const expiresAtMs = nowMs + bid.expiresInSeconds * 1000;
      for (const lead of BID_LEAD_TIMES_MS) {
        const triggerAtMs = expiresAtMs - lead;
        if (triggerAtMs <= nowMs) continue;
        result.push({
          id: `bid-${bid.playerId}-${lead}`,
          title: 'Gebot läuft bald ab',
          body: `${bid.playerName}: Listing läuft in ${formatCountdown(lead)} ab.`,
          triggerAtMs,
        });
      }
    }
  }

  return result.sort((a, b) => a.triggerAtMs - b.triggerAtMs).slice(0, MAX_PENDING_NOTIFICATIONS);
}
