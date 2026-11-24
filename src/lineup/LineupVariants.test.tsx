import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import { squadPlayer } from '@/test/squadPlayer';
import { LineupVariants } from './LineupVariants';

vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ userId: 'me' }) }));

it('öffnet einen gespeicherten Entwurf nach einem Verkauf mit freiem Platz', () => {
  const onLoad = vi.fn();
  const saved = squadPlayer();
  function editor(inSquad: boolean) {
    return render(<LeagueIdProvider id="liga"><LineupVariants draftIds={[saved.id]} formation="4-4-2"
      players={inSquad ? new Map([[saved.id, saved]]) : new Map()} onLoad={onLoad} /></LeagueIdProvider>);
  }
  const initial = editor(true);
  fireEvent.click(screen.getByText('Meine Aufstellungsvarianten'));
  fireEvent.click(screen.getAllByText('Entwurf hier sichern')[0]);
  initial.unmount();
  editor(false);
  fireEvent.click(screen.getByText('Meine Aufstellungsvarianten'));
  fireEvent.click(screen.getByText('Plan A laden · 4-4-2'));
  expect(onLoad).toHaveBeenCalledWith('4-4-2', [], expect.stringContaining('Kaderänderungen'));
});
