import { describe, expect, it } from 'vitest';
import { toMatchdaySchedule, toSeasonPerformances } from '@/api/kickbase/mappers';
import { pointAverages, withPointAverages } from './pointAverages';

const now = Date.parse('2026-10-17T22:00:00Z');
function data(scores: number[], minutes = scores.map((p) => p === 0 ? 0 : 90)) {
  const rows = scores.map((p, index) => ({
    day: index + 1, md: `2026-09-${String(index + 1).padStart(2, '0')}T15:30:00Z`,
    t1: 'a', t2: 'b', pt: 'a', t1g: 0, t2g: 0, p, mp: `${minutes[index]}'`,
  }));
  return {
    performance: toSeasonPerformances({ it: [{ ti: '2026/27', ph: rows }] }),
    schedule: toMatchdaySchedule({ it: rows.map((r) => ({ day: r.day, it: [{ ...r, dt: r.md }] })) }),
  };
}

describe('pointAverages', () => {
  it('zählt 150/150/0/0/0 als 60 je Spieltag und 150 je Einsatz', () => {
    const { performance, schedule } = data([150, 150, 0, 0, 0]);
    expect(pointAverages(performance, schedule, now)).toEqual({
      matchdayAverage: 60, appearanceAverage: 150, matches: 5, appearances: 2,
    });
  });

  it('unterscheidet echte Nullpunkte von fehlender Historie', () => {
    const { performance, schedule } = data([0, 0]);
    expect(pointAverages(performance, schedule, now)).toEqual({
      matchdayAverage: 0, appearanceAverage: null, matches: 2, appearances: 0,
    });
    expect(pointAverages([], schedule, now)).toBeNull();
    expect(pointAverages(performance, undefined, now)).toBeNull();
  });

  it('behält negative Punkte und echte Punkte bei fehlenden/gerundeten Minuten', () => {
    const { performance, schedule } = data([-30, 90, 0], [0, 0, 90]);
    expect(pointAverages(performance, schedule, now)).toEqual({
      matchdayAverage: 20, appearanceAverage: 20, matches: 3, appearances: 3,
    });
  });

  it('schließt Zukunft, Live-Ergebnisse und verschobene Spiele ohne Ergebnis aus', () => {
    const { performance, schedule } = data([100, 300, 400, 500]);
    const days = performance[0]!.matchdays;
    const matchdays = schedule.matchdays;
    // Trotz beider Live-Torfelder noch keine abgeschlossene Partie.
    days[1]!.matchDate = matchdays[1]!.fixtures[0]!.kickoffAt = '2026-10-17T21:00:00Z';
    days[2]!.matchDate = matchdays[2]!.fixtures[0]!.kickoffAt = '2026-10-18T15:30:00Z';
    days[3]!.hasResult = false;
    matchdays[3]!.fixtures[0]!.hasResult = false;
    expect(pointAverages(performance, schedule, now)?.matchdayAverage).toBe(100);
  });

  it('verwendet vor Saisonbeginn keine vorherige Saison', () => {
    const { performance, schedule } = data([200]);
    performance[0]!.matchdays[0]!.matchDate = '2025-09-01T15:30:00Z';
    expect(pointAverages(performance, schedule, now)).toBeNull();
  });

  it('zählt nur zugeordnete Spiele und erfindet bei einem Zugang keine früheren Nullspiele', () => {
    const { performance, schedule } = data([0, 0, 90]);
    performance[0]!.matchdays[0]!.playerTeamId = '';
    performance[0]!.matchdays[1]!.playerTeamId = 'anderer-verein';
    expect(pointAverages(performance, schedule, now)?.matches).toBe(1);
    // Eine fehlende Zeile kann ebenso ein Liga-Zugang sein: nicht aus dem Plan ergänzen.
    performance[0]!.matchdays.splice(0, 2);
    expect(pointAverages(performance, schedule, now)?.matchdayAverage).toBe(90);
  });

  it('behält belegte Spiele vor einem ligainternen Wechsel und dedupliziert Paarungen', () => {
    const { performance, schedule } = data([100, 0]);
    performance[0]!.matchdays[0]!.playerTeamId = 'b';
    performance.push(performance[0]!);
    expect(pointAverages(performance, schedule, now)).toEqual({
      matchdayAverage: 50, appearanceAverage: 100, matches: 2, appearances: 1,
    });
  });

  it('rechnet Punkte/Mio aus dem neuen Schnitt, ohne den Rohspieler zu ändern', () => {
    const player = { averagePoints: 150, valueScoreAvg: 15, marketValue: 10_000_000 };
    expect(withPointAverages(player, { matchdayAverage: 60, appearanceAverage: 150, matches: 5, appearances: 2 }))
      .toMatchObject({ averagePoints: 60, valueScoreAvg: 6, averagePointsBasis: 'matchdays' });
    expect(player.averagePoints).toBe(150);
  });
});
