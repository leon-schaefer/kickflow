import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketPlayer } from '@/api/kickbase';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import type { BudgetLimit } from '@/utils/budget';
import { computeBudgetLimit } from '@/utils/budget';
import { OfferModal } from './OfferModal';

/**
 * 329 Zeilen Formular, dessen Validierung (src/utils/offer.ts) und
 * Budgetrechnung (src/utils/budget.ts) schon getestet sind — geprüft wird
 * hier das Zusammenspiel: Vorbelegung, Schnellwahl, die beiden Mutationen und
 * dass das gemeinsame Modal darunter liegt.
 */
const state = vi.hoisted(() => ({
  limit: null as BudgetLimit | null,
  place: { mutateAsync: vi.fn(), isPending: false },
  remove: { mutateAsync: vi.fn(), isPending: false },
}));

vi.mock('@/leagues/useBudgetLimit', () => ({ useBudgetLimit: () => state.limit }));
vi.mock('@/queries/hooks', () => ({
  usePlaceOffer: () => state.place,
  useRemoveOffer: () => state.remove,
}));

function makePlayer(overrides: Partial<MarketPlayer> = {}): MarketPlayer {
  return {
    id: '42',
    name: 'Musiala',
    position: 'MID',
    teamId: '2',
    marketValue: 10_000_000,
    marketValueTrend: 'up',
    totalPoints: 400,
    averagePoints: 120,
    valueScoreAvg: 12,
    valueScoreTotal: 40,
    status: 'fit',
    imageUrl: null,
    price: 11_000_000,
    isBotListing: false,
    sellerName: 'Leon',
    sellerId: '9',
    offerCount: 1,
    listedAt: null,
    expiresInSeconds: null,
    ownOfferPrice: null,
    ownOfferId: null,
    offers: [],
    ...overrides,
  };
}

function setup(player: MarketPlayer | null = makePlayer()) {
  const onClose = vi.fn();
  const view = render(
    <LeagueIdProvider id="1">
      <OfferModal player={player} onClose={onClose} />
    </LeagueIdProvider>,
  );
  return { onClose, ...view };
}

function priceInput() {
  return screen.getByRole('textbox', { name: 'Mein Gebot' });
}

beforeEach(() => {
  state.limit = computeBudgetLimit({ budget: 30_000_000, teamValue: 60_000_000 });
  state.place = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
  state.remove = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('OfferModal', () => {
  it('rendert nichts ohne Spieler', () => {
    const { container } = setup(null);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('liegt im gemeinsamen Modal — Portal am body, nicht im Teilbaum', () => {
    const { container } = setup();
    // Der Grund steht in Modal.tsx: im Baum gerendert könnte ein Wisch im
    // offenen Dialog Pull-to-Refresh auslösen.
    expect(container).toBeEmptyDOMElement();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('belegt das Feld mit dem Angebotspreis vor', () => {
    setup();
    expect(priceInput()).toHaveValue('11.000.000');
    expect(screen.getByRole('dialog', { name: /^Gebot für Musiala/ })).toBeInTheDocument();
  });

  it('belegt mit dem eigenen Gebot vor, wenn schon eins liegt', () => {
    setup(makePlayer({ ownOfferPrice: 12_500_000, ownOfferId: 'o1' }));

    expect(priceInput()).toHaveValue('12.500.000');
    expect(screen.getByRole('dialog', { name: /^Gebot ändern für/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gebot ändern' })).toBeInTheDocument();
  });

  it('überschreibt die Eingabe NICHT, wenn derselbe Spieler neu hereinkommt', () => {
    const { rerender } = setup();
    fireEvent.change(priceInput(), { target: { value: '9000000' } });

    // Ein Refetch im Hintergrund (Pull-to-Refresh) liefert ein neues
    // Player-Objekt mit gleicher id — der Effect hängt deshalb an player?.id.
    rerender(
      <LeagueIdProvider id="1">
        <OfferModal player={makePlayer({ price: 11_500_000 })} onClose={vi.fn()} />
      </LeagueIdProvider>,
    );
    expect(priceInput()).toHaveValue('9.000.000');
  });

  it('zeigt die Fakten als Paare aus Bezeichnung und Wert', () => {
    setup(makePlayer({ expiresInSeconds: 3600 }));

    const facts = screen.getByRole('dialog');
    expect(within(facts).getByText('Marktwert')).toBeInTheDocument();
    expect(within(facts).getByText('Läuft ab')).toBeInTheDocument();
    expect(within(facts).getByText('Leon')).toBeInTheDocument();
  });

  it('lässt „Läuft ab" weg, wenn das Listing nicht abläuft', () => {
    setup();
    // Manager-Listings laufen nie ab.
    expect(screen.queryByText('Läuft ab')).not.toBeInTheDocument();
  });

  it('nennt Kickbase als Verkäufer bei Bot-Listings', () => {
    setup(makePlayer({ isBotListing: true, sellerName: null }));
    expect(screen.getByText('Kickbase')).toBeInTheDocument();
  });

  it.each([
    ['MW', '10.000.000'],
    ['+5%', '11.550.000'],
    ['+10%', '12.100.000'],
  ])('übernimmt die Schnellwahl %s', async (chip, expected) => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: chip }));
    expect(priceInput()).toHaveValue(expected);
  });

  it('gibt das Gebot ab und schließt', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Gebot abgeben' }));

    expect(state.place.mutateAsync).toHaveBeenCalledWith({ playerId: '42', price: 11_000_000 });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('zeigt den Fehler der Mutation und bleibt offen', async () => {
    state.place.mutateAsync = vi.fn().mockRejectedValue(new Error('Gebot zu niedrig'));
    const { onClose } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Gebot abgeben' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Gebot zu niedrig');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sperrt das Abgeben, solange die Eingabe nicht gültig ist', async () => {
    setup();
    await userEvent.clear(priceInput());

    // Die Meldung kommt aus validateOffer, nicht aus dieser Komponente.
    expect(screen.getByRole('button', { name: 'Gebot abgeben' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte ein Gebot eingeben.');
  });

  it('warnt, wenn das Gebot den Rahmen sprengt', async () => {
    state.limit = computeBudgetLimit({ budget: 1_000_000, teamValue: 3_000_000 });
    setup();

    expect(screen.getByRole('alert')).toHaveTextContent(/Limit erreicht/);
    expect(screen.getByRole('button', { name: 'Gebot abgeben' })).toBeDisabled();
  });

  it('zieht ein eigenes Gebot zurück', async () => {
    const { onClose } = setup(makePlayer({ ownOfferPrice: 12_000_000, ownOfferId: 'o1' }));

    await userEvent.click(screen.getByRole('button', { name: 'Gebot zurückziehen' }));

    expect(state.remove.mutateAsync).toHaveBeenCalledWith({ playerId: '42', offerId: 'o1' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('bietet das Zurückziehen nur mit eigenem Gebot an', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Gebot zurückziehen' })).not.toBeInTheDocument();
  });

  it('sperrt beide Aktionen während einer laufenden Mutation', () => {
    state.place.isPending = true;
    setup();

    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Lädt' })).toBeInTheDocument();
  });

  it('schließt über Abbrechen', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('schließt über Escape', () => {
    const { onClose } = setup();
    // Escape löst im Browser `cancel` am dialog aus; jsdom kennt das nicht.
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
