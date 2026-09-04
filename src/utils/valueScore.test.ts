import { describe, expect, it } from 'vitest';
import { pointsPerMillion } from './valueScore';

describe('pointsPerMillion', () => {
  it('berechnet Punkte pro Million Marktwert', () => {
    expect(pointsPerMillion(90, 9_000_000)).toBe(10);
    expect(pointsPerMillion(620, 9_000_000)).toBeCloseTo(68.888, 2);
  });
  it('gibt 0 zurück bei Marktwert <= 0 statt Infinity/NaN', () => {
    expect(pointsPerMillion(90, 0)).toBe(0);
    expect(pointsPerMillion(90, -1000)).toBe(0);
  });
  it('gibt 0 bei 0 Punkten zurück', () => {
    expect(pointsPerMillion(0, 9_000_000)).toBe(0);
  });
});
