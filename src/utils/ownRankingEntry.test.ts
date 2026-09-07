import { describe, expect, it } from 'vitest';
import type { LeagueRankingEntry } from '@/api/kickbase';
import { findOwnRankingEntry } from './ownRankingEntry';

function entry(overrides: Partial<LeagueRankingEntry>): LeagueRankingEntry {
  return {
    userId: 'x',
    userName: 'Manager',
    userImageUrl: null,
    isAdmin: false,
    hasLineupSet: true,
    seasonPoints: 0,
    seasonPlace: 1,
    matchdayPoints: 0,
    matchdayPlace: 1,
    teamValue: 0,
    lineupPlayerIds: [],
    h2hOpponentUserId: null,
    h2hPlace: 0,
    h2hSeasonPoints: 0,
    h2hMatchdayPoints: 0,
    ...overrides,
  };
}

describe('findOwnRankingEntry', () => {
  it('nimmt die eigene User-ID, wenn sie bekannt ist', () => {
    const entries = [entry({ userId: 'rival' }), entry({ userId: 'me' })];
    expect(findOwnRankingEntry(entries, 'me', [])?.userId).toBe('me');
  });

  it('gibt null, wenn die eigene ID in der Tabelle fehlt', () => {
    expect(findOwnRankingEntry([entry({ userId: 'rival' })], 'me', ['p1'])).toBeNull();
  });

  it('erkennt die eigene Zeile ohne User-ID am eigenen Kader', () => {
    // Der Fall nach einem Reload mit einer Session von vor der Persistierung:
    // ein Spieler gehört pro Liga genau einem Manager.
    const entries = [
      entry({ userId: 'rival', lineupPlayerIds: ['r1', 'r2'] }),
      entry({ userId: 'me', lineupPlayerIds: ['p1', 'p2', null] }),
    ];
    expect(findOwnRankingEntry(entries, null, ['p1', 'p2', 'p3'])?.userId).toBe('me');
  });

  it('lässt sich von einem seither gekauften Spieler nicht täuschen', () => {
    // Die `lp[]` der Saisonwertung sind der Stand des letzten abgerechneten
    // Spieltags: der gekaufte `p1` steht dort noch beim Verkäufer.
    const entries = [
      entry({ userId: 'seller', lineupPlayerIds: ['p1', 's2', 's3'] }),
      entry({ userId: 'me', lineupPlayerIds: ['p2', 'p3'] }),
    ];
    expect(findOwnRankingEntry(entries, null, ['p1', 'p2', 'p3'])?.userId).toBe('me');
  });

  it('rät nicht, wenn zwei Zeilen gleich gut passen', () => {
    const entries = [
      entry({ userId: 'a', lineupPlayerIds: ['p1'] }),
      entry({ userId: 'b', lineupPlayerIds: ['p2'] }),
    ];
    expect(findOwnRankingEntry(entries, null, ['p1', 'p2'])).toBeNull();
  });

  it('gibt null, solange weder ID noch Kader bekannt sind', () => {
    expect(findOwnRankingEntry([entry({ userId: 'me' })], null, [])).toBeNull();
  });
});
