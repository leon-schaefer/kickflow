import { describe, expect, it } from 'vitest';
import { DEFAULT_NOTIFICATION_PREFERENCES } from './preferences';
import { desiredNotifications, MAX_PENDING_NOTIFICATIONS } from './scheduler';

const now = new Date('2026-09-01T12:00:00Z').getTime();

describe('desiredNotifications', () => {
  it('plant T-24h/T-3h/T-1h vor einer bekannten Deadline', () => {
    const deadlineIso = '2026-09-03T18:30:00Z'; // ~54,5h in der Zukunft
    const result = desiredNotifications(
      { deadline: { day: 3, deadlineIso }, openBids: [], preferences: DEFAULT_NOTIFICATION_PREFERENCES },
      now,
    );
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.id)).toEqual([
      `deadline-3-${24 * 60 * 60_000}`,
      `deadline-3-${3 * 60 * 60_000}`,
      `deadline-3-${60 * 60_000}`,
    ]);
    // Nächste zuerst.
    expect(result[0]!.triggerAtMs).toBeLessThan(result[1]!.triggerAtMs);
    expect(result[1]!.triggerAtMs).toBeLessThan(result[2]!.triggerAtMs);
  });

  it('lässt bereits verstrichene Erinnerungs-Zeitpunkte weg, statt sie nachzuholen', () => {
    // Deadline in nur 2 Stunden — T-24h und T-3h liegen schon in der Vergangenheit.
    const deadlineIso = new Date(now + 2 * 60 * 60_000).toISOString();
    const result = desiredNotifications(
      { deadline: { day: 5, deadlineIso }, openBids: [], preferences: DEFAULT_NOTIFICATION_PREFERENCES },
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(`deadline-5-${60 * 60_000}`);
  });

  it('plant nichts, wenn deadlineReminders deaktiviert ist', () => {
    const deadlineIso = '2026-09-03T18:30:00Z';
    const result = desiredNotifications(
      {
        deadline: { day: 3, deadlineIso },
        openBids: [],
        preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, deadlineReminders: false },
      },
      now,
    );
    expect(result).toEqual([]);
  });

  it('plant T-30min/T-10min vor Ablauf eines offenen Gebots', () => {
    const result = desiredNotifications(
      {
        deadline: null,
        openBids: [{ playerId: '42', playerName: 'Grifo', expiresInSeconds: 40 * 60 }],
        preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      },
      now,
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual([`bid-42-${30 * 60_000}`, `bid-42-${10 * 60_000}`]);
  });

  it('lässt eine Ablauf-Erinnerung weg, wenn ihr Vorlauf schon verstrichen ist', () => {
    // Nur noch 5 Minuten bis zum Ablauf — sowohl T-30min als auch T-10min liegen in der Vergangenheit.
    const result = desiredNotifications(
      {
        deadline: null,
        openBids: [{ playerId: '42', playerName: 'Grifo', expiresInSeconds: 5 * 60 }],
        preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      },
      now,
    );
    expect(result).toEqual([]);
  });

  it('plant nichts, wenn bidExpiryReminders deaktiviert ist', () => {
    const result = desiredNotifications(
      {
        deadline: null,
        openBids: [{ playerId: '42', playerName: 'Grifo', expiresInSeconds: 40 * 60 }],
        preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, bidExpiryReminders: false },
      },
      now,
    );
    expect(result).toEqual([]);
  });

  it('begrenzt auf MAX_PENDING_NOTIFICATIONS, nächste zuerst', () => {
    const openBids = Array.from({ length: 40 }, (_, i) => ({
      playerId: String(i),
      playerName: `Spieler ${i}`,
      expiresInSeconds: 40 * 60 + i, // je Spieler leicht unterschiedlich, damit die Reihenfolge eindeutig ist
    }));
    const result = desiredNotifications(
      { deadline: null, openBids, preferences: DEFAULT_NOTIFICATION_PREFERENCES },
      now,
    );
    expect(result).toHaveLength(MAX_PENDING_NOTIFICATIONS);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.triggerAtMs).toBeGreaterThanOrEqual(result[i - 1]!.triggerAtMs);
    }
  });

  it('liefert eine leere Liste ohne Deadline und ohne Gebote statt zu crashen', () => {
    expect(desiredNotifications({ deadline: null, openBids: [], preferences: DEFAULT_NOTIFICATION_PREFERENCES }, now)).toEqual(
      [],
    );
  });

  it('ignoriert eine unparsbare Deadline statt zu crashen', () => {
    const result = desiredNotifications(
      { deadline: { day: 1, deadlineIso: 'nicht-parsbar' }, openBids: [], preferences: DEFAULT_NOTIFICATION_PREFERENCES },
      now,
    );
    expect(result).toEqual([]);
  });
});
