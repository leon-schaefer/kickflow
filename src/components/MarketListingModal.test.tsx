import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SquadPlayer } from '@/api/kickbase';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import type { SellPlan } from '@/utils/sellPlan';
import { MarketListingModal } from './MarketListingModal';

/**
 * Die Rechnung selbst (Vorbelegung, Aufschlag, Summen, Validierung) liegt in
 * src/utils/marketListing.ts und ist dort getestet — hier geht es um das
 * Zusammenspiel: was im Dialog steht, was abgeschickt wird und was passiert,
 * wenn ein einzelnes Listing scheitert.
 */
const state = vi.hoisted(() => ({
  list: { mutateAsync: vi.fn(), isPending: false },
}));

vi.mock('@/queries/hooks', () => ({ useListPlayerOnMarket: () => state.list }));

function makePlayer(id: string, name: string, marketValue: number, onMarket = false): SquadPlayer {
  return { id, name, marketValue, onMarket, position: 'MID', status: 'fit' } as SquadPlayer;
}

const players = [
  makePlayer('1', 'Kimmich', 10_000_000),
  makePlayer('2', 'Sané', 4_000_000),
  makePlayer('3', 'Wirtz', 8_000_000),
];

function makePlan(playerIds: string[] = ['2', '1']): SellPlan {
  return {
    sell: playerIds.map((playerId) => ({
      playerId,
      marketValue: players.find((p) => p.id === playerId)!.marketValue,
      wasInBestXi: false,
    })),
    proceeds: 0,
    balanceAfter: 0,
    result: {} as SellPlan['result'],
    scoreLoss: 0,
    feasible: true,
    shortfall: 0,
    excludedValue: 0,
    excludedCount: 0,
  };
}

function setup({
  plan = makePlan(),
  budget = -12_000_000,
  squad = players,
}: { plan?: SellPlan | null; budget?: number; squad?: SquadPlayer[] } = {}) {
  const onClose = vi.fn();
  const view = render(
    <LeagueIdProvider id="42">
      <MarketListingModal
        open
        onClose={onClose}
        players={squad}
        plan={plan}
        budget={budget}
      />
    </LeagueIdProvider>,
  );
  return { onClose, ...view };
}

function priceField(name: string) {
  return screen.getByRole('textbox', { name: `Preis für ${name}` });
}

function submit() {
  return screen.getByRole('button', { name: 'Auf den Markt stellen' });
}

beforeEach(() => {
  state.list = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('MarketListingModal', () => {
  it('rendert nichts, solange er zu ist', () => {
    const { container } = render(
      <LeagueIdProvider id="42">
        <MarketListingModal
          open={false}
          onClose={vi.fn()}
          players={players}
          plan={makePlan()}
          budget={-1}
        />
      </LeagueIdProvider>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('liegt im gemeinsamen Modal — Portal am body, nicht im Teilbaum', () => {
    const { container } = setup();

    expect(container).toBeEmptyDOMElement();
    expect(screen.getByRole('dialog', { name: 'Auf den Markt stellen' })).toBeInTheDocument();
  });

  it('zeigt die Pflichtverkäufe in der Reihenfolge des Plans, vorbelegt mit dem Marktwert', () => {
    setup();

    expect(priceField('Sané')).toHaveValue('4.000.000');
    expect(priceField('Kimmich')).toHaveValue('10.000.000');
    // Wirtz steht nicht im Plan.
    expect(screen.queryByRole('textbox', { name: 'Preis für Wirtz' })).not.toBeInTheDocument();
  });

  it('setzt mit der Schnellwahl alle Preise zugleich', async () => {
    setup();

    await userEvent.click(screen.getByRole('button', { name: '+10 %' }));

    expect(priceField('Sané')).toHaveValue('4.400.000');
    expect(priceField('Kimmich')).toHaveValue('11.000.000');
  });

  it('rechnet den Kontostand nach den geplanten Verkäufen vor', () => {
    setup({ budget: -12_000_000 });

    expect(screen.getByText(/2 Spieler/)).toHaveTextContent('14 Mio € → Konto 2 Mio €');
  });

  it('nennt den Restfehlbetrag, wenn die Auswahl nicht reicht', async () => {
    setup({ budget: -12_000_000 });

    await userEvent.click(screen.getByRole('checkbox', { name: /Kimmich/ }));

    expect(screen.getByText(/1 Spieler/)).toHaveTextContent('Konto -8 Mio € · es fehlen 8 Mio €');
  });

  it('listet die ausgewählten Spieler nacheinander und schließt danach', async () => {
    const { onClose } = setup();

    await userEvent.click(submit());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(state.list.mutateAsync.mock.calls.map(([input]) => input)).toEqual([
      { playerId: '2', price: 4_000_000 },
      { playerId: '1', price: 10_000_000 },
    ]);
  });

  it('schickt einen von Hand geänderten Preis mit', async () => {
    setup({ plan: makePlan(['1']) });

    await userEvent.clear(priceField('Kimmich'));
    await userEvent.type(priceField('Kimmich'), '12500000');
    await userEvent.click(submit());

    await waitFor(() =>
      expect(state.list.mutateAsync).toHaveBeenCalledWith({ playerId: '1', price: 12_500_000 }),
    );
  });

  it('lässt abgewählte Spieler weg', async () => {
    setup();

    await userEvent.click(screen.getByRole('checkbox', { name: /Sané/ }));
    await userEvent.click(submit());

    await waitFor(() => expect(state.list.mutateAsync).toHaveBeenCalledTimes(1));
    expect(state.list.mutateAsync).toHaveBeenCalledWith({ playerId: '1', price: 10_000_000 });
  });

  it('zeigt schon gelistete Spieler an, wählt sie aber nicht aus', () => {
    setup({ squad: [makePlayer('1', 'Kimmich', 10_000_000, true), players[1]!] });

    const checkbox = screen.getByRole('checkbox', { name: /Kimmich/ });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(screen.getByText('Steht bereits am Markt.')).toBeInTheDocument();
  });

  it('bleibt offen und schreibt den Grund an die gescheiterte Zeile', async () => {
    state.list.mutateAsync = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Spieler ist gesperrt'));
    const { onClose } = setup();

    await userEvent.click(submit());

    expect(await screen.findByText('Spieler ist gesperrt')).toBeInTheDocument();
    expect(screen.getByText('Steht jetzt am Markt.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('1 Spieler konnte nicht gelistet werden');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('listet einen erfolgreichen Spieler beim zweiten Anlauf nicht erneut', async () => {
    state.list.mutateAsync = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Serverfehler'))
      .mockResolvedValue(undefined);
    setup();

    await userEvent.click(submit());
    await screen.findByText('Serverfehler');
    await userEvent.click(submit());

    await waitFor(() => expect(state.list.mutateAsync).toHaveBeenCalledTimes(3));
    expect(state.list.mutateAsync.mock.calls.map(([input]) => input.playerId)).toEqual([
      '2',
      '1',
      '1',
    ]);
  });

  it('sperrt das Abschicken ohne Auswahl', async () => {
    setup({ plan: makePlan(['1']) });

    await userEvent.click(screen.getByRole('checkbox', { name: /Kimmich/ }));

    expect(submit()).toBeDisabled();
    expect(screen.getByText('Keinen Spieler ausgewählt.')).toBeInTheDocument();
  });

  it('sagt es, wenn der Plan niemanden vorschlägt', () => {
    setup({ plan: null });

    expect(screen.getByText('Kein Spieler zum Verkauf vorgeschlagen.')).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });
});
