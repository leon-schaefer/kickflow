import { describe, expect, it } from 'vitest';
import type { MatchdayPerformance, SeasonPerformance } from '@/api/kickbase';
import { latestSeason, pointsPerMinute, sumPlaytime } from './playtime';

function matchday(overrides: Partial<MatchdayPerformance>): MatchdayPerformance {
  return {
    matchday: 1,
    matchDate: '2026-08-30T13:30:00Z',
    homeTeamId: '5',
    awayTeamId: '10',
    homeGoals: 4,
    awayGoals: 1,
    homeLogoUrl: null,
    awayLogoUrl: null,
    playerTeamId: '10',
    hasResult: true,
    points: 0,
    seasonAveragePoints: 0,
    seasonTotalPoints: 0,
    minutesPlayed: 0,
    isCurrent: false,
    ...overrides,
  };
}

function season(title: string, matchdays: MatchdayPerformance[] = []): SeasonPerformance {
  return { title, leagueName: 'Bundesliga', matchdays };
}

describe('sumPlaytime', () => {
  it('summiert Punkte und Minuten der ausgetragenen Spieltage', () => {
    const totals = sumPlaytime([
      matchday({ matchday: 1, points: 8, minutesPlayed: 90 }),
      matchday({ matchday: 2, points: 3, minutesPlayed: 27 }),
    ]);
    expect(totals).toEqual({ points: 11, minutes: 117 });
  });

  it('ignoriert Spieltage ohne Ergebnis', () => {
    const totals = sumPlaytime([
      matchday({ matchday: 1, points: 8, minutesPlayed: 90 }),
      // Kommender Spieltag: käme in der echten Antwort mit 0/0, hier bewusst
      // mit Werten belegt, damit der hasResult-Filter nachweisbar greift.
      matchday({ matchday: 2, hasResult: false, points: 99, minutesPlayed: 90 }),
    ]);
    expect(totals).toEqual({ points: 8, minutes: 90 });
  });

  it('liefert 0/0 für eine leere Spieltagsliste', () => {
    expect(sumPlaytime([])).toEqual({ points: 0, minutes: 0 });
  });

  it('zählt Spieltage ohne Einsatz mit, ohne die Minuten zu erhöhen', () => {
    const totals = sumPlaytime([
      matchday({ matchday: 1, points: 0, minutesPlayed: 0 }),
      matchday({ matchday: 2, points: 6, minutesPlayed: 45 }),
    ]);
    expect(totals).toEqual({ points: 6, minutes: 45 });
  });
});

describe('pointsPerMinute', () => {
  it('berechnet Punkte pro Spielminute', () => {
    expect(pointsPerMinute(11, 117)).toBeCloseTo(0.094, 3);
    expect(pointsPerMinute(90, 900)).toBe(0.1);
  });

  it('gibt 0 zurück bei 0 oder negativen Minuten statt Infinity/NaN', () => {
    expect(pointsPerMinute(8, 0)).toBe(0);
    expect(pointsPerMinute(8, -90)).toBe(0);
  });

  it('kann negativ werden — Kickbase vergibt auch Minuspunkte', () => {
    expect(pointsPerMinute(-20, 90)).toBeCloseTo(-0.222, 3);
  });
});

describe('latestSeason', () => {
  it('wählt den letzten Eintrag, weil Kickbase aufsteigend sortiert', () => {
    const seasons = [season('2025/2026'), season('2026/2027')];
    expect(latestSeason(seasons)?.title).toBe('2026/2027');
  });

  it('gibt undefined bei leerer Liste zurück', () => {
    expect(latestSeason([])).toBeUndefined();
  });
});
