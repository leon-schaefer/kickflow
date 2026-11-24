import { describe, expect, it } from 'vitest';
import { availableForRebid, computeBudgetLimit, sumOpenOffers } from './budget';

describe('computeBudgetLimit', () => {
  it('rechnet das Beispiel aus der Kickbase-Hilfe exakt nach', () => {
    // https://help.kickbase.com/help/wie-weit-darf-ich-ins-minus
    const limit = computeBudgetLimit({ budget: -10_000_000, teamValue: 100_000_000 });
    expect(limit.minBalance).toBe(-30_000_000);
    expect(limit.overdraftAllowance).toBe(30_000_000);
    expect(limit.available).toBe(20_000_000);
    expect(limit.overLimit).toBe(false);
  });

  it('nutzt bei positivem Kontostand den reinen Mannschaftswert als Basis', () => {
    const limit = computeBudgetLimit({ budget: 5_000_000, teamValue: 90_000_000 });
    expect(limit.minBalance).toBe(-30_000_000);
    expect(limit.available).toBe(35_000_000);
  });

  it('liefert keinen Rahmen bei Mannschaftswert 0', () => {
    const limit = computeBudgetLimit({ budget: 0, teamValue: 0 });
    expect(limit.minBalance).toBe(0);
    expect(limit.overdraftAllowance).toBe(0);
    expect(limit.available).toBe(0);
  });

  it('zieht offene Gebote vom verfügbaren Spielraum ab', () => {
    const limit = computeBudgetLimit({ budget: 5_000_000, teamValue: 90_000_000, pendingOffers: 3_000_000 });
    expect(limit.balanceAfterPendingOffers).toBe(2_000_000);
    expect(limit.available).toBe(32_000_000);
  });

  it('erkennt overLimit, wenn der Kontostand die Untergrenze bereits unterschreitet', () => {
    // Basis = 60 Mio + (-30 Mio) = 30 Mio -> Untergrenze -10 Mio, aber das
    // Konto steht bereits bei -30 Mio (z.B. durch Marktwertverfall).
    const limit = computeBudgetLimit({ budget: -30_000_000, teamValue: 60_000_000 });
    expect(limit.minBalance).toBe(-10_000_000);
    expect(limit.overLimit).toBe(true);
    expect(limit.available).toBe(0);
  });

  it('klemmt available nie unter 0', () => {
    const limit = computeBudgetLimit({ budget: -30_000_000, teamValue: 90_000_000, pendingOffers: 10_000_000 });
    expect(limit.available).toBe(0);
  });

  it('berechnet deficit als das, was zum Ausgleich auf 0 fehlt', () => {
    expect(computeBudgetLimit({ budget: -12_400_000, teamValue: 100_000_000 }).deficit).toBe(12_400_000);
    expect(computeBudgetLimit({ budget: 5_000_000, teamValue: 100_000_000 }).deficit).toBe(0);
    expect(computeBudgetLimit({ budget: 0, teamValue: 100_000_000 }).deficit).toBe(0);
  });
});

describe('availableForRebid', () => {
  it('gibt das eigene Gebot auf denselben Spieler wieder frei — ein Nachgebot ersetzt es', () => {
    const limit = computeBudgetLimit({ budget: 5_000_000, teamValue: 90_000_000, pendingOffers: 3_000_000 });
    expect(availableForRebid(limit, 3_000_000)).toBe(limit.available + 3_000_000);
  });

  it('lässt den Spielraum ohne eigenes Gebot unverändert', () => {
    const limit = computeBudgetLimit({ budget: 5_000_000, teamValue: 90_000_000, pendingOffers: 3_000_000 });
    expect(availableForRebid(limit, null)).toBe(limit.available);
  });

  it('rechnet unter der Grenze exakt statt das Gebot auf die geklemmte 0 zu addieren', () => {
    // Konto 5 Mio, Rahmen 30 Mio, eigenes Gebot 40 Mio (etwa nach
    // Marktwertverfall überzeichnet): mit ihm liegt das Konto 5 Mio unter der
    // Grenze, `available` klemmt auf 0. Frei für ein Nachgebot sind 35 Mio —
    // nicht die 40 Mio, die 0 + eigenes Gebot ergäbe.
    const limit = computeBudgetLimit({ budget: 5_000_000, teamValue: 90_000_000, pendingOffers: 40_000_000 });
    expect(limit.available).toBe(0);
    expect(availableForRebid(limit, 40_000_000)).toBe(35_000_000);
  });
});

describe('sumOpenOffers', () => {
  const market = [
    { id: 'a', ownOfferPrice: 1_000_000 },
    { id: 'b', ownOfferPrice: null },
    { id: 'c', ownOfferPrice: 2_500_000 },
  ];

  it('summiert alle eigenen Gebote', () => {
    expect(sumOpenOffers(market)).toBe(3_500_000);
  });

  it('ignoriert Spieler ohne eigenes Gebot', () => {
    expect(sumOpenOffers([{ id: 'x', ownOfferPrice: null }])).toBe(0);
  });

  it('schließt den übergebenen Spieler aus (Upsert-Fall)', () => {
    expect(sumOpenOffers(market, 'a')).toBe(2_500_000);
  });

  it('gibt 0 bei leerer Marktliste zurück', () => {
    expect(sumOpenOffers([])).toBe(0);
  });
});
