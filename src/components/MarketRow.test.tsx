import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MarketPlayer } from '@/api/kickbase';
import { MarketRow } from './MarketRow';

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
    sellerName: null,
    sellerId: null,
    offerCount: 0,
    listedAt: null,
    expiresInSeconds: null,
    ownOfferPrice: null,
    ownOfferId: null,
    offers: [],
    ...overrides,
  };
}

function setup(overrides: Partial<MarketPlayer> = {}) {
  const onClick = vi.fn();
  const onBid = vi.fn();
  render(
    <MarketRow player={makePlayer(overrides)} metric="avgPerMillion" onClick={onClick} onBid={onBid} />,
  );
  return { onClick, onBid };
}

describe('MarketRow', () => {
  it('öffnet über die Zeile das Spieler-Detail', async () => {
    const { onClick, onBid } = setup();
    await userEvent.click(screen.getByText('Musiala'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onBid).not.toHaveBeenCalled();
  });

  it('öffnet über die Pille NUR das Gebot, nicht zusätzlich das Detail', async () => {
    const { onClick, onBid } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Bieten' }));

    // Genau der Grund, aus dem die Zeile ein div role="button" ist und die
    // Pille ein stopPropagation trägt: sonst landet man im Detail statt im
    // Gebots-Dialog.
    expect(onBid).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('beschriftet die Pille um, wenn schon ein eigenes Gebot liegt', () => {
    setup({ ownOfferPrice: 12_000_000 });
    expect(screen.getByRole('button', { name: 'Ändern' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bieten' })).not.toBeInTheDocument();
  });

  it('zeigt das eigene Gebot mit Hammer-Icon, nicht mit einem Punkt', () => {
    const { container } = render(
      <MarketRow
        player={makePlayer({ ownOfferPrice: 12_000_000 })}
        metric="avgPerMillion"
        onBid={vi.fn()}
      />,
    );
    // Der Punkt hier war der `fallback` eines nie geladenen Hammer-Symbols und
    // von jedem anderen Punkt der Zeile nicht zu unterscheiden.
    const offerRow = screen.getByText('12 Mio €').parentElement!;
    expect(offerRow.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('[class*="ownOfferDot"]')).toBeNull();
  });

  it('zeigt den Aufschlag auf den Marktwert, nicht den Marktwert selbst', () => {
    setup({ price: 11_000_000, marketValue: 10_000_000 });
    expect(screen.getByText('+10 %')).toBeInTheDocument();
  });

  it('zeigt die Restlaufzeit nur bei Kickbase-Listings', () => {
    const { container } = render(
      <MarketRow player={makePlayer()} metric="avgPerMillion" onBid={vi.fn()} />,
    );
    // Manager-Listings laufen nie ab — dann steht dort gar nichts.
    expect(container.textContent).not.toMatch(/\d+\s*h/);
  });
});
