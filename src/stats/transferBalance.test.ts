import { describe, expect, it } from 'vitest';
import type { PlayerTransfer } from '@/api/kickbase';
import { buildTransferSpells, summarizeTransfers, type TransferSpell } from './transferBalance';

const ME = 'me';

function transfer(date: string, buyerId: string | null, price: number | null): PlayerTransfer {
  return { date, buyerId, buyerName: buyerId, price };
}

interface Options {
  transfersByPlayer: Record<string, PlayerTransfer[]>;
  ownUserId?: string | null;
  names?: Record<string, string>;
  marketValues?: Record<string, number>;
  ownSquad?: string[];
}

function build({
  transfersByPlayer,
  ownUserId = ME,
  names = {},
  marketValues = {},
  ownSquad = [],
}: Options): TransferSpell[] {
  return buildTransferSpells({
    transfersByPlayer: new Map(Object.entries(transfersByPlayer)),
    ownUserId,
    names: new Map(Object.entries(names)),
    marketValues: new Map(Object.entries(marketValues)),
    ownSquad: new Set(ownSquad),
  });
}

describe('buildTransferSpells', () => {
  it('liest Gewinn aus dem eigenen Kauf und dem darauffolgenden Weiterverkauf', () => {
    const [spell] = build({
      transfersByPlayer: {
        goldgriff: [
          // Absichtlich in der Reihenfolge der API (jüngster zuerst).
          transfer('2026-11-02T10:00:00Z', 'rival', 9_000_000),
          transfer('2026-09-01T10:00:00Z', ME, 5_000_000),
          transfer('2026-08-01T10:00:00Z', 'vorbesitzer', 4_000_000),
        ],
      },
      names: { goldgriff: 'Goldgriff' },
    });

    expect(spell).toMatchObject({
      name: 'Goldgriff',
      buyPrice: 5_000_000,
      sellPrice: 9_000_000,
      profit: 4_000_000,
      realized: true,
    });
  });

  it('bewertet einen noch gehaltenen Spieler gegen seinen heutigen Marktwert', () => {
    const [spell] = build({
      transfersByPlayer: { halte: [transfer('2026-09-01T10:00:00Z', ME, 3_000_000)] },
      marketValues: { halte: 4_500_000 },
      ownSquad: ['halte'],
    });

    expect(spell).toMatchObject({ sellPrice: null, profit: 1_500_000, realized: false });
  });

  it('lässt einen Spieler weg, der weder weiterverkauft noch im Kader ist', () => {
    // Abgang ans Kickbase-Angebot taucht in der Historie nicht auf — dann ist
    // der Erlös unbekannt und keine Zeile besser als eine geratene.
    expect(
      build({
        transfersByPlayer: { verschwunden: [transfer('2026-09-01T10:00:00Z', ME, 3_000_000)] },
        marketValues: { verschwunden: 4_000_000 },
      }),
    ).toEqual([]);
  });

  it('überspringt Zeiträume ohne Preis auf einer der beiden Seiten', () => {
    expect(
      build({
        transfersByPlayer: {
          ohneKauf: [transfer('2026-09-01T10:00:00Z', ME, null), transfer('2026-10-01T10:00:00Z', 'rival', 8_000_000)],
          ohneVerkauf: [transfer('2026-09-01T10:00:00Z', ME, 2_000_000), transfer('2026-10-01T10:00:00Z', 'rival', null)],
        },
      }),
    ).toEqual([]);
  });

  it('zählt zwei Besitzzeiträume desselben Spielers einzeln', () => {
    const spells = build({
      transfersByPlayer: {
        rückkehrer: [
          transfer('2026-09-01T10:00:00Z', ME, 1_000_000),
          transfer('2026-10-01T10:00:00Z', 'rival', 3_000_000),
          transfer('2026-11-01T10:00:00Z', ME, 4_000_000),
          transfer('2026-12-01T10:00:00Z', 'anderer', 2_000_000),
        ],
      },
    });

    expect(spells.map((spell) => spell.profit)).toEqual([2_000_000, -2_000_000]);
  });

  it('ignoriert fremde Transfers vollständig', () => {
    expect(
      build({
        transfersByPlayer: {
          fremd: [transfer('2026-09-01T10:00:00Z', 'rival', 1_000_000), transfer('2026-10-01T10:00:00Z', 'anderer', 5_000_000)],
        },
      }),
    ).toEqual([]);
  });

  it('liefert ohne eigene User-ID gar nichts, statt fremde Transfers zu vereinnahmen', () => {
    expect(
      build({
        ownUserId: null,
        transfersByPlayer: {
          egal: [transfer('2026-09-01T10:00:00Z', ME, 1_000_000), transfer('2026-10-01T10:00:00Z', 'rival', 5_000_000)],
        },
      }),
    ).toEqual([]);
  });

  it('sortiert den größten Gewinn nach oben und den größten Verlust nach unten', () => {
    const spells = build({
      transfersByPlayer: {
        gewinn: [transfer('2026-09-01T10:00:00Z', ME, 1_000_000), transfer('2026-10-01T10:00:00Z', 'rival', 6_000_000)],
        mittel: [transfer('2026-09-01T10:00:00Z', ME, 1_000_000), transfer('2026-10-01T10:00:00Z', 'rival', 2_000_000)],
        verlust: [transfer('2026-09-01T10:00:00Z', ME, 8_000_000), transfer('2026-10-01T10:00:00Z', 'rival', 3_000_000)],
      },
    });

    expect(spells.map((spell) => spell.playerId)).toEqual(['gewinn', 'mittel', 'verlust']);
  });
});

describe('summarizeTransfers', () => {
  const spells: TransferSpell[] = [
    {
      playerId: 'a',
      name: 'A',
      buyPrice: 1,
      buyDate: '2026-09-01T10:00:00Z',
      sellPrice: 5,
      sellDate: '2026-10-01T10:00:00Z',
      profit: 4,
      realized: true,
    },
    {
      playerId: 'b',
      name: 'B',
      buyPrice: 10,
      buyDate: '2026-09-01T10:00:00Z',
      sellPrice: 7,
      sellDate: '2026-10-01T10:00:00Z',
      profit: -3,
      realized: true,
    },
    {
      playerId: 'c',
      name: 'C',
      buyPrice: 2,
      buyDate: '2026-09-01T10:00:00Z',
      sellPrice: null,
      sellDate: null,
      profit: 9,
      realized: false,
    },
  ];

  it('hält realisierte und offene Gewinne auseinander', () => {
    expect(summarizeTransfers(spells)).toMatchObject({
      realizedProfit: 1,
      openProfit: 9,
      realizedCount: 2,
    });
  });

  it('findet Bestes und Schlechtestes auch in unsortierter Liste, ohne den Buchgewinn zu küren', () => {
    const shuffled = [spells[1], spells[2], spells[0]];
    const summary = summarizeTransfers(shuffled);
    expect(summary.best?.playerId).toBe('a');
    expect(summary.worst?.playerId).toBe('b');
  });

  it('meldet ohne abgeschlossene Verkäufe null statt eines erfundenen Bestwerts', () => {
    expect(summarizeTransfers([spells[2]])).toMatchObject({ best: null, worst: null, realizedProfit: 0 });
  });
});
