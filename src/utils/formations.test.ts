import { describe, expect, it } from 'vitest';
import { AVAILABLE_FORMATIONS, requiredCountsForFormation } from './formations';

describe('requiredCountsForFormation', () => {
  it('parst "3-4-3" zu GK 1, DEF 3, MID 4, FWD 3', () => {
    expect(requiredCountsForFormation('3-4-3')).toEqual({ GK: 1, DEF: 3, MID: 4, FWD: 3 });
  });

  it('jede Formation aus AVAILABLE_FORMATIONS summiert auf exakt 11 Spieler', () => {
    // Diese Invariante ist die Voraussetzung dafür, dass Summe und Mittel im
    // Optimizer dasselbe Ranking erzeugen — hier geprüft statt angenommen.
    for (const formation of AVAILABLE_FORMATIONS) {
      const required = requiredCountsForFormation(formation);
      const total = required.GK + required.DEF + required.MID + required.FWD;
      expect(total).toBe(11);
    }
  });

  it('liefert bei unparsbarem Input den dokumentierten Fallback', () => {
    const fallback = { GK: 1, DEF: 0, MID: 0, FWD: 0 };
    expect(requiredCountsForFormation('')).toEqual(fallback);
    expect(requiredCountsForFormation('foo')).toEqual(fallback);
    expect(requiredCountsForFormation('4-4')).toEqual(fallback);
  });
});
