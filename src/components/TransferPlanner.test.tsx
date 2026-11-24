import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { UNCONSTRAINED_CONSTRAINTS } from '@/lineup/rules';
import { marketPlayer } from '@/test/marketPlayer';
import { squadPlayer } from '@/test/squadPlayer';
import { TransferPlanner } from './TransferPlanner';

it('verrechnet das Gebot mit dem eingegebenen Erlös und kennzeichnet die unvollständige Elf', () => {
  render(<TransferPlanner squad={[squadPlayer({ marketValue: 200 })]}
    market={[marketPlayer({ price: 350 })]} balance={100} constraints={UNCONSTRAINED_CONSTRAINTS}
    onClose={vi.fn()} />);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'm1' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Musiala' }));
  expect(screen.getByText('Kontostand -50 €')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Erlös für Musiala in Euro'), { target: { value: '500' } });
  expect(screen.getByText('Kontostand 250 €')).toBeVisible();
  expect(screen.getByText(/keine vollständige regelkonforme Elf/)).toBeVisible();
});
