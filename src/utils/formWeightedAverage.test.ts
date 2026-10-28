import { describe, expect, it } from 'vitest';
import {
  FORM_DECAY,
  FORM_MIN_MATCHES,
  FORM_WINDOW,
  formWeightedAverage,
} from './formWeightedAverage';

describe('formWeightedAverage', () => {
  it('fällt unter FORM_MIN_MATCHES auf den flachen Schnitt zurück', () => {
    const flat = 100;
    expect(formWeightedAverage([{ points: 0 }, { points: 200 }], flat)).toEqual({
      formAverage: flat,
      trend: 0,
    });
    expect(FORM_MIN_MATCHES).toBe(3);
  });

  it('liegt bei steigender Serie über dem flachen Schnitt', () => {
    const matches = [{ points: 0 }, { points: 50 }, { points: 100 }, { points: 150 }, { points: 200 }];
    const flat = matches.reduce((sum, m) => sum + m.points, 0) / matches.length;
    const { formAverage, trend } = formWeightedAverage(matches, flat);
    expect(formAverage).toBeGreaterThan(flat);
    expect(trend).toBeGreaterThan(0);
  });

  it('liegt bei fallender Serie unter dem flachen Schnitt', () => {
    const matches = [{ points: 200 }, { points: 150 }, { points: 100 }, { points: 50 }, { points: 0 }];
    const flat = matches.reduce((sum, m) => sum + m.points, 0) / matches.length;
    const { formAverage, trend } = formWeightedAverage(matches, flat);
    expect(formAverage).toBeLessThan(flat);
    expect(trend).toBeLessThan(0);
  });

  it('gewichtet nur die letzten FORM_WINDOW Spiele', () => {
    const old = Array.from({ length: FORM_WINDOW }, () => ({ points: 0 }));
    const recent = Array.from({ length: FORM_WINDOW }, () => ({ points: 100 }));
    const matches = [...old, ...recent];
    const flat = 50;
    const { formAverage } = formWeightedAverage(matches, flat);
    // Ohne Fenster wären die Nullen noch spürbar; mit Fenster ≈ 100.
    expect(formAverage).toBeCloseTo(100, 5);
  });

  it('gibt dem jüngsten Spiel das Gewicht 1 und dem davor FORM_DECAY', () => {
    const matches = [{ points: 0 }, { points: 0 }, { points: 100 }];
    const flat = 100 / 3;
    const { formAverage } = formWeightedAverage(matches, flat);
    const weightSum = FORM_DECAY ** 2 + FORM_DECAY + 1;
    expect(formAverage).toBeCloseTo(100 / weightSum, 10);
  });
});
