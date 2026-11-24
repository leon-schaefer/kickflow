import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { UNCONSTRAINED_CONSTRAINTS } from '@/lineup/rules';
import { mockLineupData } from '@/mock/mockLineup';
import { marketPlayer } from '@/test/marketPlayer';
import { squadPlayer } from '@/test/squadPlayer';
import { TransferPlanner } from './TransferPlanner';

it('verrechnet das Gebot mit dem eingegebenen Erlös und kennzeichnet die unvollständige Elf', () => {
  render(<TransferPlanner squad={[squadPlayer({ marketValue: 200 })]}
    market={[marketPlayer({ price: 350 })]} balance={100} constraints={UNCONSTRAINED_CONSTRAINTS}
    onClose={vi.fn()} />);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'm1' } });
  fireEvent.click(screen.getByText('Geplante Verkäufe'));
  fireEvent.click(screen.getByRole('checkbox', { name: /Musiala/ }));
  expect(screen.getByText('-50 €')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Erlös für Musiala in Euro'), { target: { value: '500' } });
  fireEvent.click(screen.getByText('Geplante Verkäufe'));
  expect(screen.getByText('250 €')).toBeVisible();
  expect(screen.getByText(/keine vollständige regelkonforme Elf/)).toBeVisible();
});

it('zeigt die Punkteprognose auch bei ungültigem Gebot und klappt die beste Elf auf', () => {
  render(<TransferPlanner squad={mockLineupData.players} market={[marketPlayer()]} balance={0}
    constraints={UNCONSTRAINED_CONSTRAINTS} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Geplanter Zugang'), { target: { value: 'm1' } });
  fireEvent.change(screen.getByLabelText('Geplantes Gebot'), { target: { value: '' } });
  expect(screen.getByLabelText('Geplantes Gebot')).toBeInvalid();
  expect(screen.getByText(/positive Beträge/)).toBeVisible();
  expect(screen.getByText('Erwartete Punkte')).toBeVisible();
  fireEvent.click(screen.getByText('Beste Elf'));
  expect(screen.getAllByRole('listitem')).toHaveLength(11);
});

it('erklärt einen Markt ohne wählbaren Zugang und lässt sich schließen', () => {
  const onClose = vi.fn();
  render(<TransferPlanner squad={[squadPlayer()]} market={[marketPlayer({ id: '1' })]} balance={100}
    constraints={UNCONSTRAINED_CONSTRAINTS} onClose={onClose} />);
  expect(screen.getByText(/keinen Marktspieler/)).toBeVisible();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
  expect(onClose).toHaveBeenCalledOnce();
});
