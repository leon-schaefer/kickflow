import { describe, expect, it } from 'vitest';
import { purchaseDelta } from './purchase';

describe('purchaseDelta', () => {
  it('rechnet den Verlust des Doku-Fixtures nach (Grifo)', () => {
    // mv 10.973.197, mvgl −15.145.453 → Kaufpreis 26.118.650, siehe mappers.test.ts
    expect(purchaseDelta(10_973_197, 26_118_650)).toEqual({
      purchasePrice: 26_118_650,
      gain: -15_145_453,
      percent: -58,
    });
  });

  it('rechnet einen Gewinn positiv aus', () => {
    expect(purchaseDelta(12_000_000, 10_000_000)).toEqual({
      purchasePrice: 10_000_000,
      gain: 2_000_000,
      percent: 20,
    });
  });

  it('behandelt "genau auf Kaufpreis" als Ergebnis, nicht als Fehlen', () => {
    expect(purchaseDelta(5_000_000, 5_000_000)).toEqual({
      purchasePrice: 5_000_000,
      gain: 0,
      percent: 0,
    });
  });

  it('liefert null ohne bekannten Kaufpreis (fremder Spieler)', () => {
    expect(purchaseDelta(5_000_000, null)).toBeNull();
  });

  it('liefert null bei Kaufpreis 0 oder negativ (kein Bezugspunkt für Prozent)', () => {
    expect(purchaseDelta(5_000_000, 0)).toBeNull();
    expect(purchaseDelta(5_000_000, -1)).toBeNull();
  });
});
