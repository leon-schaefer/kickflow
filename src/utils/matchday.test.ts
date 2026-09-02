import { describe, expect, it } from 'vitest';
import type { MatchdaySchedule } from '@/api/kickbase';
import { resolveLineupMatchday, resolveMatchdayState } from './matchday';

describe('resolveMatchdayState', () => {
  // Der reale Fall, der den "Spieltag 0 nach Spieltag 1 durch"-Bug ausgelöst
  // hat: Spieltag 1 wurde am 30.08. angepfiffen und ist durch (allPlayed),
  // heute ist der 31.08. — Spieltag 2 (Anstoß 04.09.) muss offen sein.
  const now = new Date('2026-08-31T11:55:00Z').getTime();
  const schedule: MatchdaySchedule = {
    currentDay: 1,
    matchdays: [
      { day: 1, firstKickoff: '2026-08-30T13:30:00Z', allPlayed: true, fixtures: [] },
      { day: 2, firstKickoff: '2026-09-04T18:30:00Z', allPlayed: false, fixtures: [] },
      { day: 3, firstKickoff: '2026-09-12T16:30:00Z', allPlayed: false, fixtures: [] },
    ],
  };

  it('erkennt den nächsten offenen Spieltag, wenn der vorherige komplett durch ist', () => {
    const state = resolveMatchdayState(schedule, now);
    expect(state.running).toBeNull();
    expect(state.open).toEqual({ day: 2, deadline: '2026-09-04T18:30:00Z' });
  });

  it('erkennt einen laufenden Spieltag (angepfiffen, aber noch nicht komplett abgerechnet)', () => {
    const midMatchday: MatchdaySchedule = {
      currentDay: 1,
      matchdays: [
        { day: 1, firstKickoff: '2026-08-30T13:30:00Z', allPlayed: false, fixtures: [] },
        { day: 2, firstKickoff: '2026-09-04T18:30:00Z', allPlayed: false, fixtures: [] },
      ],
    };
    const state = resolveMatchdayState(midMatchday, now);
    expect(state.running).toEqual({ day: 1 });
    expect(state.open).toEqual({ day: 2, deadline: '2026-09-04T18:30:00Z' });
  });

  it('vor dem ersten Spieltag der Saison ist nur "open" gesetzt', () => {
    const beforeSeason: MatchdaySchedule = {
      currentDay: 1,
      matchdays: [
        { day: 1, firstKickoff: '2026-08-30T13:30:00Z', allPlayed: false, fixtures: [] },
        { day: 2, firstKickoff: '2026-09-04T18:30:00Z', allPlayed: false, fixtures: [] },
      ],
    };
    const beforeKickoff = new Date('2026-08-20T00:00:00Z').getTime();
    const state = resolveMatchdayState(beforeSeason, beforeKickoff);
    expect(state.running).toBeNull();
    expect(state.open).toEqual({ day: 1, deadline: '2026-08-30T13:30:00Z' });
  });

  it('nach dem letzten Spieltag der Saison ist nichts mehr offen', () => {
    const seasonEnd: MatchdaySchedule = {
      currentDay: 34,
      matchdays: [{ day: 34, firstKickoff: '2027-05-15T13:30:00Z', allPlayed: true, fixtures: [] }],
    };
    const afterSeason = new Date('2027-05-16T00:00:00Z').getTime();
    const state = resolveMatchdayState(seasonEnd, afterSeason);
    expect(state).toEqual({ running: null, open: null });
  });

  it('liefert null/null bei leerem Spielplan statt zu crashen', () => {
    expect(resolveMatchdayState({ currentDay: null, matchdays: [] }, now)).toEqual({
      running: null,
      open: null,
    });
  });

  it('sortiert unabhängig von der Reihenfolge in der API-Antwort', () => {
    const unsorted: MatchdaySchedule = {
      currentDay: 1,
      matchdays: [...schedule.matchdays].reverse(),
    };
    expect(resolveMatchdayState(unsorted, now)).toEqual(resolveMatchdayState(schedule, now));
  });

  it('überspringt Spieltage ohne Anstoßzeit bei der Suche nach dem offenen Spieltag', () => {
    const missingKickoff: MatchdaySchedule = {
      currentDay: 1,
      matchdays: [
        { day: 1, firstKickoff: '2026-08-30T13:30:00Z', allPlayed: true, fixtures: [] },
        { day: 2, firstKickoff: null, allPlayed: false, fixtures: [] },
        { day: 3, firstKickoff: '2026-09-12T16:30:00Z', allPlayed: false, fixtures: [] },
      ],
    };
    const state = resolveMatchdayState(missingKickoff, now);
    expect(state.open).toEqual({ day: 3, deadline: '2026-09-12T16:30:00Z' });
  });
});

describe('resolveLineupMatchday', () => {
  it('nimmt den laufenden Spieltag — dessen Elf ist die, die gerade zählt', () => {
    const state = { running: { day: 3 }, open: { day: 4, deadline: '2026-09-12T16:30:00Z' } };
    expect(resolveLineupMatchday(state, 2)).toEqual({ day: 3, phase: 'running' });
  });

  it('läuft keiner, nimmt es den nächsten offenen — NICHT den abgerechneten', () => {
    const state = { running: null, open: { day: 4, deadline: '2026-09-12T16:30:00Z' } };
    expect(resolveLineupMatchday(state, 3)).toEqual({ day: 4, phase: 'open' });
  });

  it('fällt auf currentDay zurück, wenn der Spielplan nichts hergibt (Saisonende)', () => {
    expect(resolveLineupMatchday({ running: null, open: null }, 34)).toEqual({ day: 34, phase: 'fallback' });
  });

  it('liefert null, wenn es auch kein currentDay gibt', () => {
    expect(resolveLineupMatchday({ running: null, open: null }, null)).toBeNull();
  });
});
