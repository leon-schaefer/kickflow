import { describe, expect, it } from 'vitest';
import { filterOwnBids, sortByExpiry } from './marketList';

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
