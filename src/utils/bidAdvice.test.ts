import { describe, expect, it } from 'vitest';
import { deriveBidAdvice, valueCeiling, type BidAdviceInput } from './bidAdvice';

/**
 * Die Aufschläge selbst sind Augenmaß und dürfen sich ändern (siehe Modul-Doku)
 * — festgehalten werden hier deshalb die STRUKTURELLEN Aussagen, die immer
 * gelten müssen: das Gebot liegt nie unter der Wettbewerbs-Untergrenze, nie
 * über dem verfügbaren Rahmen, es steigt mit dem Wettbewerb, und die
 * Wertobergrenze verbietet nichts, sondern warnt.
 */
function input(overrides: Partial<BidAdviceInput> = {}): BidAdviceInput {
  return {
    price: 10_000_000,
    marketValue: 10_000_000,
    offerCount: 0,
    isBotListing: true,
    expiresInSeconds: null,
    averagePoints: 100,
    // 100 Ø-Punkte bei 10 Ø-Punkten/Mio => Wertobergrenze 10 Mio, also genau
    // der Marktwert. Wer den Aufschlag prüfen will, dreht an einer der beiden.
    referenceValueScore: 10,
    available: null,
    ...overrides,
  };
}

describe('valueCeiling', () => {
  it('rechnet Ø-Punkte gegen die Kader-Effizienz in einen Preis um', () => {
    // 90 Punkte bei 9 Punkten/Mio Referenz => 10 Mio.
    expect(valueCeiling(90, 9)).toBe(10_000_000);
  });

  it('ohne Referenz keine Obergrenze', () => {
    expect(valueCeiling(90, 0)).toBeNull();
  });
});

describe('deriveBidAdvice', () => {
  it('bietet über der Wettbewerbs-Untergrenze, nie darunter', () => {
    const advice = deriveBidAdvice(input({ referenceValueScore: 0 }));
    expect(advice.competitiveBid).toBe(10_000_000);
    expect(advice.bid).toBeGreaterThan(10_000_000);
    expect(advice.verdict).toBe('bieten');
  });

  it('nimmt bei einem Angebot unter Marktwert den Marktwert als Untergrenze', () => {
    // Ein Schnäppchen sehen alle — der Angebotspreis ist dort keine
    // realistische Zuschlagsgrenze, auch wenn Kickbase ihn annehmen würde.
    const advice = deriveBidAdvice(input({ price: 6_000_000, referenceValueScore: 0 }));
    expect(advice.minBid).toBe(6_000_000);
    expect(advice.competitiveBid).toBe(10_000_000);
    expect(advice.bid).toBeGreaterThanOrEqual(10_000_000);
  });

  it('legt für jedes vorliegende Gebot etwas drauf, aber nicht unbegrenzt', () => {
    const none = deriveBidAdvice(input({ offerCount: 0, referenceValueScore: 0 }));
    const two = deriveBidAdvice(input({ offerCount: 2, referenceValueScore: 0 }));
    const many = deriveBidAdvice(input({ offerCount: 20, referenceValueScore: 0 }));

    expect(two.bid!).toBeGreaterThan(none.bid!);
    expect(many.bid!).toBeGreaterThan(two.bid!);
    // Deckel: das 20. Gebot treibt den Preis nicht weiter als das vierte.
    const four = deriveBidAdvice(input({ offerCount: 4, referenceValueScore: 0 }));
    expect(many.bid).toBe(four.bid);
  });

  it('legt beim Manager-Listing mehr drauf als bei Kickbase', () => {
    const bot = deriveBidAdvice(input({ isBotListing: true, referenceValueScore: 0 }));
    const manager = deriveBidAdvice(input({ isBotListing: false, referenceValueScore: 0 }));
    expect(manager.bid!).toBeGreaterThan(bot.bid!);
  });

  it('legt kurz vor Ablauf drauf — danach gibt es kein Nachbessern', () => {
    const early = deriveBidAdvice(input({ expiresInSeconds: 20 * 3600, referenceValueScore: 0 }));
    const late = deriveBidAdvice(input({ expiresInSeconds: 600, referenceValueScore: 0 }));
    expect(late.bid!).toBeGreaterThan(early.bid!);
  });

  it('warnt über der Wertobergrenze, verbietet aber nichts', () => {
    // Referenz 10 Ø-Punkte/Mio, Spieler 100 Ø-Punkte => Obergrenze 10 Mio.
    // Der nötige Preis liegt mit Aufschlag darüber.
    const advice = deriveBidAdvice(input());
    expect(advice.ceiling).toBe(10_000_000);
    expect(advice.verdict).toBe('ueber-wert');
    expect(advice.bid).not.toBeNull();
    expect(advice.reason).toContain('Über Wert');
  });

  it('bleibt unter der Obergrenze bei einem Spieler, der sie verdient', () => {
    const advice = deriveBidAdvice(input({ averagePoints: 200 }));
    expect(advice.ceiling).toBe(20_000_000);
    expect(advice.verdict).toBe('bieten');
  });

  it('deckelt das Gebot am 33%-Rahmen statt es zu überschreiten', () => {
    // Der Rahmen liegt über dem Angebotspreis (also kein 'kein-budget'), aber
    // unter dem empfohlenen Gebot inkl. Aufschlag.
    const uncapped = deriveBidAdvice(input({ referenceValueScore: 0 })).bid!;
    const available = 10_100_000;
    expect(uncapped).toBeGreaterThan(available);

    const advice = deriveBidAdvice(input({ available, referenceValueScore: 0 }));
    expect(advice.bid).toBe(available);
    expect(advice.cappedByBudget).toBe(true);
    expect(advice.verdict).toBe('bieten');
  });

  it('verweigert das Gebot, wenn nicht einmal der Angebotspreis gedeckt ist', () => {
    const advice = deriveBidAdvice(input({ available: 9_000_000 }));
    expect(advice.bid).toBeNull();
    expect(advice.verdict).toBe('kein-budget');
    expect(advice.minBid).toBe(10_000_000);
  });

  it('macht ohne bekannten Rahmen weiter — unbekannt ist kein Verbot', () => {
    const advice = deriveBidAdvice(input({ available: null, referenceValueScore: 0 }));
    expect(advice.cappedByBudget).toBe(false);
    expect(advice.bid).not.toBeNull();
  });

  it('rundet auf glatte Tausender auf', () => {
    const advice = deriveBidAdvice(input({ price: 1_234_567, marketValue: 0, referenceValueScore: 0 }));
    expect(advice.bid! % 1_000).toBe(0);
    expect(advice.bid!).toBeGreaterThanOrEqual(1_234_567);
  });
});
