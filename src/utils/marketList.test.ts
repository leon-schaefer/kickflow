import { describe, expect, it } from 'vitest';
import { filterOwnBids, filteredScoreKey, marketMarkupPercent, sortByExpiry } from './marketList';

describe('marketMarkupPercent', () => {
  it('rechnet den Aufschlag auf den Marktwert in ganze Prozent', () => {
    expect(marketMarkupPercent(12_400_000, 9_800_000)).toBe(27);
  });

  it('gibt einen Abschlag negativ zurück', () => {
    expect(marketMarkupPercent(8_800_000, 10_000_000)).toBe(-12);
  });

  it('gibt null zurück, wenn der Preis faktisch dem Marktwert entspricht', () => {
    expect(marketMarkupPercent(10_000_000, 10_000_000)).toBeNull();
    // 0,4 % runden auf 0 % — eine "±0 %"-Zeile wäre reines Rauschen.
    expect(marketMarkupPercent(10_040_000, 10_000_000)).toBeNull();
  });

  it('gibt null ohne Angebotspreis oder ohne Marktwert zurück', () => {
    expect(marketMarkupPercent(undefined, 10_000_000)).toBeNull();
    expect(marketMarkupPercent(5_000_000, 0)).toBeNull();
  });
});

describe('filterOwnBids', () => {
  it('behält nur Listings mit eigenem Gebot', () => {
    const players = [
      { id: 'a', ownOfferPrice: 5_000_000 },
      { id: 'b', ownOfferPrice: null },
      { id: 'c' },
      { id: 'd', ownOfferPrice: 1_200_000 },
    ];
    expect(filterOwnBids(players).map((p) => p.id)).toEqual(['a', 'd']);
  });

  it('behandelt ein Gebot von 0 als vorhandenes Gebot', () => {
    expect(filterOwnBids([{ id: 'a', ownOfferPrice: 0 }])).toHaveLength(1);
  });

  it('kommt mit einer leeren Liste klar', () => {
    expect(filterOwnBids([])).toEqual([]);
  });
});

describe('sortByExpiry', () => {
  it('stellt die kürzeste Restlaufzeit nach vorn', () => {
    const players = [
      { id: 'spaet', expiresInSeconds: 86_400 },
      { id: 'gleich', expiresInSeconds: 600 },
      { id: 'mittel', expiresInSeconds: 3_600 },
    ];
    expect(sortByExpiry(players).map((p) => p.id)).toEqual(['gleich', 'mittel', 'spaet']);
  });

  it('sortiert Listings ohne Ablauf ans Ende und behält dort die API-Reihenfolge', () => {
    const players = [
      { id: 'manager-1', expiresInSeconds: null },
      { id: 'kickbase', expiresInSeconds: 7_200 },
      { id: 'manager-2' },
    ];
    expect(sortByExpiry(players).map((p) => p.id)).toEqual(['kickbase', 'manager-1', 'manager-2']);
  });

  it('mutiert die Eingabe nicht', () => {
    const players = [{ id: 'a', expiresInSeconds: 200 }, { id: 'b', expiresInSeconds: 100 }];
    sortByExpiry(players);
    expect(players.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('kommt mit einer leeren Liste klar', () => {
    expect(sortByExpiry([])).toEqual([]);
  });
});

describe('filteredScoreKey', () => {
  it('gibt den zum aktiven Sortier-Wert passenden Score zurück', () => {
    expect(filteredScoreKey('avg')).toBe('avg');
    expect(filteredScoreKey('total')).toBe('total');
    expect(filteredScoreKey('perMinute')).toBe('perMinute');
  });

  it('fällt bei Ablauf-Sortierung auf Ø/Mio zurück, da die Restlaufzeit schon separat steht', () => {
    expect(filteredScoreKey('expiry')).toBe('avg');
  });
});
