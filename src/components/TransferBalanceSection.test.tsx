import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TransferSpell } from '@/stats/transferBalance';
import { summarizeTransfers } from '@/stats/transferBalance';
import { TransferBalanceSection } from './TransferBalanceSection';

function spell(overrides: Partial<TransferSpell> = {}): TransferSpell {
  return {
    playerId: 'p1',
    name: 'Goldgriff',
    buyPrice: 5_000_000,
    buyDate: '2026-08-01T10:00:00Z',
    sellPrice: 9_000_000,
    sellDate: '2026-09-01T10:00:00Z',
    profit: 4_000_000,
    realized: true,
    ...overrides,
  };
}

function setup(spells: TransferSpell[], props: Partial<Parameters<typeof TransferBalanceSection>[0]> = {}) {
  return render(
    <TransferBalanceSection spells={spells} summary={summarizeTransfers(spells)} {...props} />,
  );
}

async function expand() {
  await userEvent.click(screen.getByRole('button', { name: /Transferbilanz/ }));
}

describe('TransferBalanceSection', () => {
  it('bleibt zugeklappt, bis jemand sie öffnet — die Historie kostet Requests', async () => {
    const onExpandedChange = vi.fn();
    setup([spell()], { onExpandedChange });

    expect(screen.queryByText('Goldgriff')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Transferbilanz/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await expand();

    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('Goldgriff')).toBeInTheDocument();
  });

  it('zeigt Kauf, Verkauf und Gewinn einer abgeschlossenen Runde', async () => {
    setup([spell()]);
    await expand();

    const row = screen.getByText('Goldgriff').closest('li')!;
    expect(row).toHaveTextContent('5 Mio € am 01.08.2026');
    expect(row).toHaveTextContent('9 Mio € am 01.09.2026');
    expect(within(row).getByText('+4 Mio €')).toBeInTheDocument();
  });

  it('markiert einen Verlust als solchen — die Farbe hängt am data-sign', async () => {
    setup([spell({ sellPrice: 2_000_000, profit: -3_000_000 })]);
    await expand();

    const row = screen.getByText('Goldgriff').closest('li')!;
    expect(within(row).getByText('−3 Mio €')).toHaveAttribute('data-sign', 'negative');
  });

  it('weist einen noch nicht eingelösten Buchgewinn als offen aus', async () => {
    setup([spell({ sellPrice: null, sellDate: null, profit: 1_000_000, realized: false })]);
    await expand();

    const row = screen.getByText('Goldgriff').closest('li')!;
    expect(within(row).getByText('offen')).toBeInTheDocument();
    expect(row).toHaveTextContent('heute 6 Mio €');
    // Ein Buchgewinn zählt NICHT zur realisierten Bilanz.
    expect(screen.getByText('Realisiert').parentElement).toHaveTextContent('±0 €');
  });

  it('sagt es, wenn es nichts auszuwerten gibt', async () => {
    setup([]);
    await expand();

    expect(screen.getByText('Noch kein belegbarer eigener Transfer.')).toBeInTheDocument();
  });

  it('meldet laufende Requests, statt „nichts gefunden" zu behaupten', async () => {
    setup([], { pending: 3 });
    await expand();

    expect(screen.getByRole('status')).toHaveTextContent('noch 3 Spieler');
    expect(screen.getByText('Noch nichts ausgewertet.')).toBeInTheDocument();
  });

  it('erklärt eine fehlende User-ID, statt eine leere Liste zu zeigen', async () => {
    setup([spell()], { attributable: false });
    await expand();

    expect(screen.getByText(/Ohne deine Kickbase-Nutzerkennung/)).toBeInTheDocument();
    expect(screen.queryByText('Goldgriff')).not.toBeInTheDocument();
  });

  it('macht die Zeile nur zum Knopf, wenn es ein Ziel gibt', async () => {
    const onSelectPlayer = vi.fn();
    const { rerender } = setup([spell()]);
    await expand();
    expect(screen.queryByRole('button', { name: /Goldgriff/ })).not.toBeInTheDocument();

    rerender(
      <TransferBalanceSection
        spells={[spell()]}
        summary={summarizeTransfers([spell()])}
        onSelectPlayer={onSelectPlayer}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Goldgriff/ }));
    expect(onSelectPlayer).toHaveBeenCalledWith('p1');
  });
});
