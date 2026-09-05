import { describe, expect, it } from 'vitest';
import {
  applyMarkup,
  buildListingDraft,
  listingTotals,
  priceWithMarkup,
  selectedListings,
  setEntryPrice,
  toggleEntry,
  validateListing,
  type ListingCandidate,
} from './marketListing';

function candidate(overrides: Partial<ListingCandidate> = {}): ListingCandidate {
  return { id: '1', name: 'Spieler 1', marketValue: 10_000_000, onMarket: false, ...overrides };
}

const candidates = [
  candidate({ id: '1', name: 'Kimmich', marketValue: 10_000_000 }),
  candidate({ id: '2', name: 'Sané', marketValue: 4_000_000 }),
  candidate({ id: '3', name: 'Wirtz', marketValue: 8_000_000, onMarket: true }),
];

describe('priceWithMarkup', () => {
  it('gibt ohne Aufschlag den Marktwert zurück', () => {
    expect(priceWithMarkup(10_000_000, 0)).toBe(10_000_000);
  });
  it('rundet den Aufschlag auf ganze Euro', () => {
    expect(priceWithMarkup(1_234_567, 0.05)).toBe(1_296_295);
  });
});

describe('buildListingDraft', () => {
  it('behält die Reihenfolge des Verkaufsplans', () => {
    const entries = buildListingDraft(candidates, ['2', '1']);

    expect(entries.map((e) => e.playerId)).toEqual(['2', '1']);
    expect(entries.map((e) => e.name)).toEqual(['Sané', 'Kimmich']);
  });

  it('belegt den Preis mit dem Marktwert vor', () => {
    expect(buildListingDraft(candidates, ['1'])[0]!.priceText).toBe('10.000.000');
  });

  it('nimmt den Aufschlag in die Vorbelegung', () => {
    expect(buildListingDraft(candidates, ['1'], 0.1)[0]!.priceText).toBe('11.000.000');
  });

  it('zeigt schon gelistete Spieler, wählt sie aber nicht aus', () => {
    const [entry] = buildListingDraft(candidates, ['3']);

    expect(entry).toMatchObject({ playerId: '3', alreadyListed: true, selected: false });
  });

  it('lässt Spieler weg, die nicht mehr im Kader stehen', () => {
    expect(buildListingDraft(candidates, ['1', 'weg'])).toHaveLength(1);
  });
});

describe('applyMarkup', () => {
  it('setzt alle Preise neu, auch von Hand geänderte', () => {
    const entries = setEntryPrice(buildListingDraft(candidates, ['1', '2']), '1', '1');

    expect(applyMarkup(entries, 0.05).map((e) => e.priceText)).toEqual(['10.500.000', '4.200.000']);
  });
});

describe('toggleEntry', () => {
  it('schaltet die Auswahl um', () => {
    const entries = buildListingDraft(candidates, ['1']);

    expect(toggleEntry(entries, '1')[0]!.selected).toBe(false);
    expect(toggleEntry(toggleEntry(entries, '1'), '1')[0]!.selected).toBe(true);
  });

  it('lässt schon gelistete Spieler unauswählbar', () => {
    const entries = buildListingDraft(candidates, ['3']);

    expect(toggleEntry(entries, '3')[0]!.selected).toBe(false);
  });
});

describe('listingTotals', () => {
  it('summiert nur die ausgewählten Preise', () => {
    const entries = toggleEntry(buildListingDraft(candidates, ['1', '2']), '2');

    expect(listingTotals(entries, -5_000_000)).toMatchObject({
      count: 1,
      proceeds: 10_000_000,
      balanceAfter: 5_000_000,
      shortfall: 0,
      covers: true,
    });
  });

  it('weist den Restfehlbetrag aus, wenn die Auswahl nicht reicht', () => {
    const entries = buildListingDraft(candidates, ['2']);

    expect(listingTotals(entries, -10_000_000)).toMatchObject({
      proceeds: 4_000_000,
      balanceAfter: -6_000_000,
      shortfall: 6_000_000,
      covers: false,
    });
  });

  it('zählt ein leeres Preisfeld als 0 statt als NaN', () => {
    const entries = setEntryPrice(buildListingDraft(candidates, ['1']), '1', '');

    expect(listingTotals(entries, -1_000_000).proceeds).toBe(0);
  });
});

describe('validateListing', () => {
  it('verlangt mindestens einen ausgewählten Spieler', () => {
    expect(validateListing(buildListingDraft(candidates, ['3']))).toBe('Keinen Spieler ausgewählt.');
  });

  it('nennt die Spieler ohne Preis beim Namen', () => {
    const entries = setEntryPrice(buildListingDraft(candidates, ['1', '2']), '1', '');

    expect(validateListing(entries)).toBe('Preis fehlt für Kimmich.');
  });

  it('lässt eine vollständige Auswahl durch', () => {
    expect(validateListing(buildListingDraft(candidates, ['1', '2']))).toBeNull();
  });
});

describe('selectedListings', () => {
  it('liefert die abzuschickenden Listings in Listenreihenfolge', () => {
    const entries = setEntryPrice(buildListingDraft(candidates, ['2', '1']), '2', '4.500.000');

    expect(selectedListings(entries)).toEqual([
      { playerId: '2', price: 4_500_000 },
      { playerId: '1', price: 10_000_000 },
    ]);
  });

  it('lässt abgewählte und schon gelistete Spieler weg', () => {
    const entries = toggleEntry(buildListingDraft(candidates, ['1', '2', '3']), '1');

    expect(selectedListings(entries).map((l) => l.playerId)).toEqual(['2']);
  });
});
