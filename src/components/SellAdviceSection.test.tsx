import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SquadPlayer } from '@/api/kickbase';
import { formatCurrency } from '@/utils/format';
import type { SellAdvice } from '@/utils/sellAdvice';
import type { SellPlan } from '@/utils/sellPlan';
import { SellAdviceSection } from './SellAdviceSection';

function makePlayer(id: string, marketValue: number): SquadPlayer {
  return {
    id,
    name: `Spieler ${id}`,
    position: 'MID',
    status: 'fit',
    imageUrl: null,
    marketValue,
  } as SquadPlayer;
}

function makeAdvice(overrides: Partial<SellAdvice>): SellAdvice {
  return {
    playerId: '1',
    recommendation: 'verkaufen',
    reason: 'Begründung',
    inBestEfficiencyXi: false,
    inBestPointsXi: false,
    inAnyXi: false,
    expensive: false,
    excluded: false,
    ...overrides,
  };
}

function makePlan(overrides: Partial<SellPlan> = {}): SellPlan {
  return {
    sell: [{ playerId: '1', marketValue: 10_000_000, wasInBestXi: false }],
    proceeds: 10_000_000,
    balanceAfter: 1_000_000,
    result: {} as SellPlan['result'],
    scoreLoss: 0,
    feasible: true,
    shortfall: 0,
    excludedValue: 0,
    excludedCount: 0,
    ...overrides,
  };
}

const players = [makePlayer('1', 10_000_000), makePlayer('2', 4_000_000)];
const advice = [
  makeAdvice({ playerId: '1', recommendation: 'verkaufen' }),
  makeAdvice({ playerId: '2', recommendation: 'unverzichtbar' }),
];

describe('SellAdviceSection', () => {
  it('startet zugeklappt, damit die Save-Bar nicht aus dem Bild rutscht', () => {
    render(<SellAdviceSection players={players} advice={advice} budget={0} plan={null} />);

    expect(screen.getByRole('button', { name: /Kaufen & Verkaufen \(2\)/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('Begründung')).not.toBeInTheDocument();
  });

  it('klappt die Zeilen auf', async () => {
    render(<SellAdviceSection players={players} advice={advice} budget={0} plan={null} />);
    await userEvent.click(screen.getByRole('button', { name: /Kaufen & Verkaufen/ }));

    expect(screen.getAllByText('Begründung')).toHaveLength(2);
  });

  it('zählt nur „verkaufen" als Verkaufskandidat und summiert dessen Marktwert', () => {
    render(<SellAdviceSection players={players} advice={advice} budget={null} plan={null} />);
    // 'unverzichtbar' und 'ausgeschlossen' zählen absichtlich nicht mit.
    expect(screen.getByText(/1 Verkaufskandidat · /)).toBeInTheDocument();
  });

  it('nennt Ausschlüsse getrennt', () => {
    render(
      <SellAdviceSection
        players={players}
        advice={[advice[0], makeAdvice({ playerId: '2', recommendation: 'ausgeschlossen', excluded: true })]}
        budget={null}
        plan={null}
      />,
    );
    expect(screen.getByText(/1 ausgeschlossen/)).toBeInTheDocument();
  });

  it('hebt ein negatives Budget hervor, ohne die Zeile zu zerreißen', () => {
    render(<SellAdviceSection players={players} advice={advice} budget={-500_000} plan={null} />);

    // Der einzige verschachtelte Text des Projekts. Der Betrag steckt in
    // einem eigenen Span INNERHALB der Zusammenfassung — beides muss eine
    // Zeile bleiben, deshalb ist .summary kein Flex-Container.
    const line = screen.getByText(/Verkaufskandidat/);
    const amount = screen.getByText(formatCurrency(-500_000));
    expect(amount.tagName).toBe('SPAN');
    expect(line).toContainElement(amount);
    expect(line.textContent).toContain('· Budget ');
  });

  it('zeigt die Kontoausgleichs-Zeile nur mit Plan', () => {
    const { unmount } = render(
      <SellAdviceSection players={players} advice={advice} budget={0} plan={null} />,
    );
    expect(screen.queryByText(/Kontoausgleich/)).not.toBeInTheDocument();
    unmount();

    render(<SellAdviceSection players={players} advice={advice} budget={0} plan={makePlan()} />);
    expect(screen.getByText(/Kontoausgleich: 1 Pflichtverkauf/)).toBeInTheDocument();
  });

  it('erklärt einen ungedeckten Fehlbetrag mit den Ausschlüssen', () => {
    render(
      <SellAdviceSection
        players={players}
        advice={advice}
        budget={0}
        plan={makePlan({ feasible: false, shortfall: 2_000_000, excludedValue: 5_000_000 })}
      />,
    );
    expect(screen.getByText(/Kontoausgleich unvollständig/)).toBeInTheDocument();
    expect(screen.getByText(/stecken in ausgeschlossenen Spielern/)).toBeInTheDocument();
  });

  it('reicht den vollständigen Kaderspieler nach oben, nicht die Teilmenge der Zeile', async () => {
    const onSelectPlayer = vi.fn();
    render(
      <SellAdviceSection
        players={players}
        advice={advice}
        budget={null}
        plan={null}
        onSelectPlayer={onSelectPlayer}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Kaufen & Verkaufen/ }));
    await userEvent.click(screen.getByText('Spieler 1'));

    expect(onSelectPlayer).toHaveBeenCalledWith(players[0]);
  });

  it('bietet die Pflichtverkäufe zum Listen an, auch zugeklappt', async () => {
    const onListOnMarket = vi.fn();
    render(
      <SellAdviceSection
        players={players}
        advice={advice}
        budget={-10_000_000}
        plan={makePlan()}
        onListOnMarket={onListOnMarket}
      />,
    );

    const button = screen.getByRole('button', { name: '1 Pflichtverkauf auf den Markt stellen' });
    // Die Sektion ist zu — der Knopf steht trotzdem, siehe Kommentar dort.
    expect(screen.getByRole('button', { name: /Kaufen & Verkaufen/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await userEvent.click(button);

    expect(onListOnMarket).toHaveBeenCalledTimes(1);
  });

  it('zählt nur die Pflichtverkäufe, die noch nicht am Markt stehen', () => {
    const listed = { ...players[0]!, onMarket: true };
    render(
      <SellAdviceSection
        players={[listed, players[1]!]}
        advice={advice}
        budget={-10_000_000}
        plan={makePlan()}
        onListOnMarket={vi.fn()}
      />,
    );

    expect(screen.getByText('Alle Pflichtverkäufe stehen am Markt.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /auf den Markt stellen/ })).not.toBeInTheDocument();
  });

  it('bleibt ohne Handler reine Analyse', () => {
    render(
      <SellAdviceSection players={players} advice={advice} budget={null} plan={makePlan()} />,
    );

    expect(screen.queryByRole('button', { name: /auf den Markt stellen/ })).not.toBeInTheDocument();
  });

  it('überspringt Empfehlungen ohne Kaderspieler', async () => {
    render(
      <SellAdviceSection
        players={[players[0]]}
        advice={[...advice, makeAdvice({ playerId: 'weg' })]}
        budget={null}
        plan={null}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Kaufen & Verkaufen/ }));
    // Nur Spieler 1 steht noch im Kader — die anderen beiden fallen heraus.
    expect(screen.getAllByText('Begründung')).toHaveLength(1);
  });
});
