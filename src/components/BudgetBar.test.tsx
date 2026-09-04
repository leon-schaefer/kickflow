import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { computeBudgetLimit } from '@/utils/budget';
import { BudgetBar } from './BudgetBar';

describe('BudgetBar', () => {
  it('zeigt zugeklappt nur den verfügbaren Spielraum', () => {
    render(<BudgetBar limit={computeBudgetLimit({ budget: 5_000_000, teamValue: 30_000_000 })} />);

    expect(screen.getByText('Verfügbar')).toBeInTheDocument();
    // Die Bestandteile kosten sonst dauerhaft Platz über der Marktliste.
    expect(screen.queryByText('Konto')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('klappt die Bestandteile auf und wieder zu', async () => {
    render(<BudgetBar limit={computeBudgetLimit({ budget: 5_000_000, teamValue: 30_000_000 })} />);
    const toggle = screen.getByRole('button');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Konto')).toBeInTheDocument();
    expect(screen.getByText('Rahmen')).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.queryByText('Konto')).not.toBeInTheDocument();
  });

  it('nennt die aufgeklappten Details als das, was der Button steuert', async () => {
    render(<BudgetBar limit={computeBudgetLimit({ budget: 1, teamValue: 1 })} />);
    await userEvent.click(screen.getByRole('button'));

    // Ersetzt den accessibilityHint: aria-controls zeigt, worauf sich das
    // Auf- und Zuklappen bezieht.
    const controlled = screen.getByRole('button').getAttribute('aria-controls');
    expect(document.getElementById(controlled!)).toContainElement(screen.getByText('Konto'));
  });

  it('nennt offene Gebote nur, wenn es welche gibt', async () => {
    const { rerender } = render(
      <BudgetBar limit={computeBudgetLimit({ budget: 5_000_000, teamValue: 30_000_000 })} />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('In offenen Geboten')).not.toBeInTheDocument();

    rerender(
      <BudgetBar
        limit={computeBudgetLimit({
          budget: 5_000_000,
          teamValue: 30_000_000,
          pendingOffers: 2_000_000,
        })}
      />,
    );
    expect(screen.getByText('In offenen Geboten')).toBeInTheDocument();
  });

  it('warnt auch zugeklappt über der 33%-Grenze', () => {
    // Ohne die Warnung sähe ein `available` von 0 € wie ein leeres Konto aus
    // statt wie ein Verkaufszwang.
    const limit = computeBudgetLimit({ budget: -20_000_000, teamValue: 30_000_000 });
    expect(limit.overLimit).toBe(true);

    render(<BudgetBar limit={limit} />);
    expect(screen.getByText(/33%-Grenze/)).toBeInTheDocument();
  });
});
