import { describe, expect, it } from 'vitest';
import { toMatchdaySchedule, toSeasonPerformances } from '@/api/kickbase/mappers';
import { formWeightedAverage } from './formWeightedAverage';
import { pointAverages, settledMatchPoints, withPointAverages } from './pointAverages';

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

function withForm(
  matchdayAverage: number,
  appearanceAverage: number | null,
  matches: number,
  appearances: number,
  scores: number[],
) {
  const form = formWeightedAverage(scores.map((points) => ({ points })), matchdayAverage);
  return {
    matchdayAverage,
    appearanceAverage,
    matches,
    appearances,
    formAverage: form.formAverage,
    formTrend: form.trend,
  };
}

describe('pointAverages', () => {
  it('zählt 150/150/0/0/0 als 60 je Spieltag und 150 je Einsatz', () => {
    const { performance, schedule } = data([150, 150, 0, 0, 0]);
    expect(pointAverages(performance, schedule, now)).toEqual(
      withForm(60, 150, 5, 2, [150, 150, 0, 0, 0]),
    );
  });

  it('unterscheidet echte Nullpunkte von fehlender Historie', () => {
    const { performance, schedule } = data([0, 0]);
    expect(pointAverages(performance, schedule, now)).toEqual(
      withForm(0, null, 2, 0, [0, 0]),
    );
    expect(pointAverages([], schedule, now)).toBeNull();
    expect(pointAverages(performance, undefined, now)).toBeNull();
  });

  it('behält negative Punkte und echte Punkte bei fehlenden/gerundeten Minuten', () => {
    const { performance, schedule } = data([-30, 90, 0], [0, 0, 90]);
    expect(pointAverages(performance, schedule, now)).toEqual(
      withForm(20, 20, 3, 3, [-30, 90, 0]),
    );
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
    expect(pointAverages(performance, schedule, now)).toEqual(
      withForm(50, 100, 2, 1, [100, 0]),
    );
  });

  it('liefert settledMatchPoints chronologisch und speist Form über denselben Filter', () => {
    const { performance, schedule } = data([10, 50, 90, 130, 170]);
    const settled = settledMatchPoints(performance, schedule, now);
    expect(settled?.map((row) => row.points)).toEqual([10, 50, 90, 130, 170]);
    const averages = pointAverages(performance, schedule, now)!;
    expect(averages.formAverage).toBeGreaterThan(averages.matchdayAverage);
    expect(averages.formTrend).toBeGreaterThan(0);
  });

  it('rechnet Punkte/Mio aus dem neuen Schnitt, ohne den Rohspieler zu ändern', () => {
    const player = { averagePoints: 150, valueScoreAvg: 15, marketValue: 10_000_000 };
    expect(withPointAverages(player, {
      matchdayAverage: 60, appearanceAverage: 150, matches: 5, appearances: 2,
      formAverage: 80, formTrend: 20,
    }))
      .toMatchObject({
        averagePoints: 60,
        valueScoreAvg: 6,
        averagePointsBasis: 'matchdays',
        formAveragePoints: 80,
        formTrend: 20,
      });
    expect(player.averagePoints).toBe(150);
  });
});
