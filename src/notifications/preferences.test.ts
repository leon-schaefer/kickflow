import { describe, expect, it } from 'vitest';
import { DEFAULT_NOTIFICATION_PREFERENCES, parseStoredPreferences } from './preferences';

describe('parseStoredPreferences', () => {
  it('fällt auf die Defaults zurück, wenn nichts gespeichert ist', () => {
    expect(parseStoredPreferences(null)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it('fällt auf die Defaults zurück bei kaputtem JSON statt zu crashen', () => {
    expect(parseStoredPreferences('kein-json{')).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it('fällt auf die Defaults zurück, wenn das Schema nicht passt', () => {
    expect(parseStoredPreferences(JSON.stringify({ deadlineReminders: 'ja' }))).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES,
    );
  });

  it('übernimmt einen gültigen gespeicherten Wert unverändert', () => {
    const stored = { deadlineReminders: false, bidExpiryReminders: true };
    expect(parseStoredPreferences(JSON.stringify(stored))).toEqual(stored);
  });
});
