import { describe, expect, it } from 'vitest';
import type { PlayerTransfer } from '@/api/kickbase';
import { resolveOwnPurchase } from './playerPurchase';

function transfer(date: string, buyerId: string | null, price = 1_000_000): PlayerTransfer {
  return { date, buyerId, buyerName: buyerId ? `Manager ${buyerId}` : null, price };
}

describe('resolveOwnPurchase', () => {
  it('nimmt den jüngsten Transfer, egal wie die API sortiert hat', () => {
    const purchase = resolveOwnPurchase({
      transfers: [
        transfer('2026-08-30T18:00:00Z', 'me'),
        transfer('2026-09-02T09:30:00Z', 'me'),
        transfer('2026-05-01T12:00:00Z', 'me'),
      ],
      ownUserId: 'me',
      inOwnSquad: true,
    });
    expect(purchase?.date).toBe('2026-09-02T09:30:00Z');
  });

  it('funktioniert ohne bekannte eigene User-ID — der jüngste Käufer ist der aktuelle Besitzer', () => {
    const purchase = resolveOwnPurchase({
      transfers: [transfer('2026-04-01T10:00:00Z', 'rival'), transfer('2026-08-12T20:14:03Z', 'me')],
      ownUserId: null,
      inOwnSquad: true,
    });
    expect(purchase?.date).toBe('2026-08-12T20:14:03Z');
  });

  it('akzeptiert einen jüngsten Transfer ohne Käuferangabe (Kickbase liefert `u` nicht immer)', () => {
    const purchase = resolveOwnPurchase({
      transfers: [transfer('2026-08-12T20:14:03Z', null)],
      ownUserId: 'me',
      inOwnSquad: true,
    });
    expect(purchase?.date).toBe('2026-08-12T20:14:03Z');
  });

  it('liefert nichts, wenn der jüngste Transfer einen anderen Manager als Käufer nennt', () => {
    // Historie und Kaderstand widersprechen sich — dann lieber keine Angabe
    // als ein Datum, das dem falschen Kauf gehört.
    expect(
      resolveOwnPurchase({
        transfers: [transfer('2026-08-12T20:14:03Z', 'rival')],
        ownUserId: 'me',
        inOwnSquad: true,
      }),
    ).toBeNull();
  });

  it('liefert nichts für einen Spieler, der nicht im eigenen Kader steht', () => {
    expect(
      resolveOwnPurchase({
        transfers: [transfer('2026-08-12T20:14:03Z', 'me')],
        ownUserId: 'me',
        inOwnSquad: false,
      }),
    ).toBeNull();
  });

  it('liefert nichts ohne Transferhistorie (nie transferierter Spieler)', () => {
    expect(resolveOwnPurchase({ transfers: [], ownUserId: 'me', inOwnSquad: true })).toBeNull();
  });
});
