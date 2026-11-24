import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import { marketPlayer } from '@/test/marketPlayer';
import { playerDetail } from '@/test/playerDetail';
import { WishEditor, MarketWishlist } from './Wishlist';

vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ userId: 'manager' }) }));

it('behält das Limit ohne Angebot und erkennt beim nächsten Öffnen ein zu teures Angebot', () => {
  const player = playerDetail({ id: 'abc', name: 'Wunschspieler' });
  const edit = render(<LeagueIdProvider id="liga"><WishEditor player={player} /></LeagueIdProvider>);
  fireEvent.click(screen.getByText('Auf die Wunschliste'));
  fireEvent.change(screen.getByLabelText('Höchstpreis in Euro'), { target: { value: '900' } });
  fireEvent.click(screen.getByText('Spieler merken'));
  edit.unmount();

  const view = (price?: number) => <MemoryRouter><LeagueIdProvider id="liga">
    <MarketWishlist market={price ? [marketPlayer({ id: 'abc', price })] : []} updatedAt={Date.now()} />
  </LeagueIdProvider></MemoryRouter>;
  const market = render(view());
  expect(screen.getByText(/Limit 900 € · Kein Angebot/)).toBeVisible();
  market.rerender(view(1000));
  expect(screen.getByText(/über Limit/)).toBeVisible();
});
