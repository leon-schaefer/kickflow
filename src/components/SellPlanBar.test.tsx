import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SquadPlayer } from '@/api/kickbase';
import type { SellPlan } from '@/utils/sellPlan';
import { SellPlanBar } from './SellPlanBar';

const players = [
  { id: '1', name: 'Musiala' },
  { id: '2', name: 'Wirtz' },
] as SquadPlayer[];

function makePlan(overrides: Partial<SellPlan> = {}): SellPlan {
  return {
    sell: [{ playerId: '1', marketValue: 12_000_000, wasInBestXi: true }],
    proceeds: 12_000_000,
    balanceAfter: 2_000_000,
    result: {} as SellPlan['result'],
    scoreLoss: 0,
    feasible: true,
    shortfall: 0,
    excludedValue: 0,
    excludedCount: 0,
    ...overrides,
  };
}

describe('SellPlanBar', () => {
  it('rendert nichts ohne Plan', () => {
    // Der Aufrufer setzt `plan` nur, wenn die Checkbox aktiv UND ein Defizit
    // vorhanden ist — hier braucht es keine eigene Prüfung.
    const { container } = render(<SellPlanBar players={players} plan={null} metric="points" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('nennt Spieler beim Namen und woher er käme', () => {
    render(<SellPlanBar players={players} plan={makePlan()} metric="points" />);

    expect(screen.getByText('Musiala')).toBeInTheDocument();
    expect(screen.getByText('aus der Elf')).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('fällt auf die ID zurück, wenn der Spieler nicht im Kader steht', () => {
    render(
      <SellPlanBar
        players={[]}
        plan={makePlan({ sell: [{ playerId: '99', marketValue: 1, wasInBestXi: false }] })}
        metric="points"
      />,
    );
    expect(screen.getByText('99')).toBeInTheDocument();
    expect(screen.getByText('Bank')).toBeInTheDocument();
  });

  it('zeigt Erlös und Punktekosten, wenn der Plan aufgeht', () => {
    render(<SellPlanBar players={players} plan={makePlan({ scoreLoss: 0 })} metric="points" />);
    expect(screen.getByText(/Kosten: ohne Punkteverlust/)).toBeInTheDocument();
  });

  it('rechnet den Punkteverlust in der Einheit der aktiven Kennzahl', () => {
    const { unmount } = render(
      <SellPlanBar players={players} plan={makePlan({ scoreLoss: 12.5 })} metric="points" />,
    );
    expect(screen.getByText(/Pkt gegenüber der freien Elf/)).toBeInTheDocument();
    unmount();

    render(
      <SellPlanBar
        players={players}
        plan={makePlan({ scoreLoss: 12.5 })}
        metric="valuePerMillion"
      />,
    );
    expect(screen.getByText(/Pkt\/Mio gegenüber der freien Elf/)).toBeInTheDocument();
  });

  it('erklärt einen Fehlbetrag mit den Ausschlüssen, die ihn decken könnten', () => {
    render(
      <SellPlanBar
        players={players}
        plan={makePlan({
          feasible: false,
          shortfall: 3_000_000,
          excludedValue: 8_000_000,
          excludedCount: 2,
        })}
        metric="points"
      />,
    );
    expect(screen.getByText(/Kader deckt den Fehlbetrag nicht/)).toBeInTheDocument();
    expect(screen.getByText(/2 ausgeschlossene Spieler/)).toBeInTheDocument();
  });

  it('sagt es, wenn nach den Verkäufen keine Elf mehr steht', () => {
    // feasible: false OHNE Fehlbetrag ist der andere Fehlschlag — der Erlös
    // reichte, aber der Restkader nicht für elf Spieler.
    render(
      <SellPlanBar players={players} plan={makePlan({ feasible: false, shortfall: 0 })} metric="points" />,
    );
    expect(screen.getByText(/keine Elf mehr/)).toBeInTheDocument();
  });

  it('weist auf die Schätzung hin, in jedem Zustand', () => {
    render(<SellPlanBar players={players} plan={makePlan()} metric="points" />);
    expect(screen.getByText(/Erlös geschätzt zum Marktwert/)).toBeInTheDocument();
  });
});
