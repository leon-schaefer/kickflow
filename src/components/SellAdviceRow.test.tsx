import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SellAdvice, SellRecommendation } from '@/utils/sellAdvice';
import { SellAdviceRow, type SellAdviceRowPlayer } from './SellAdviceRow';

const player: SellAdviceRowPlayer = {
  id: '1',
  name: 'Musiala',
  position: 'MID',
  status: 'fit',
  imageUrl: null,
  marketValue: 12_000_000,
};

function makeAdvice(overrides: Partial<SellAdvice> = {}): SellAdvice {
  return {
    playerId: '1',
    recommendation: 'verkaufen',
    reason: 'Teuer und nicht in der besten Elf.',
    inBestEfficiencyXi: false,
    inBestPointsXi: false,
    inAnyXi: false,
    expensive: true,
    excluded: false,
    ...overrides,
  };
}

describe('SellAdviceRow', () => {
  it('zeigt Empfehlung und Begründung', () => {
    render(<SellAdviceRow player={player} advice={makeAdvice()} />);
    expect(screen.getByText('Verkaufen')).toBeInTheDocument();
    expect(screen.getByText('Teuer und nicht in der besten Elf.')).toBeInTheDocument();
  });

  it('trägt Position und Empfehlung als Attribute statt als Farbwerte', () => {
    render(<SellAdviceRow player={player} advice={makeAdvice()} />);
    // Vorher zwei `${farbe}26`-Konkatenationen und RECOMMENDATION_COLORS.
    expect(screen.getByText('MF')).toHaveAttribute('data-position', 'MID');
    expect(screen.getByText('Verkaufen')).toHaveAttribute('data-recommendation', 'verkaufen');
  });

  it.each(['pflichtverkauf', 'unverzichtbar', 'punkte-garant'] as SellRecommendation[])(
    'gibt jeder Empfehlung ihr eigenes Attribut (%s)',
    (recommendation) => {
      render(
        <SellAdviceRow player={player} advice={makeAdvice({ recommendation })} />,
      );
      expect(
        document.querySelector(`[data-recommendation='${recommendation}']`),
      ).toBeInTheDocument();
    },
  );

  it('ist ohne Handler keine Schaltfläche', () => {
    render(<SellAdviceRow player={player} advice={makeAdvice()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('öffnet auf Klick das Spieler-Detail', async () => {
    const onClick = vi.fn();
    render(<SellAdviceRow player={player} advice={makeAdvice()} onClick={onClick} />);
    await userEvent.click(screen.getByText('Musiala'));
    expect(onClick).toHaveBeenCalledWith(player);
  });

  it('lässt sich per Tastatur öffnen', async () => {
    const onClick = vi.fn();
    render(<SellAdviceRow player={player} advice={makeAdvice()} onClick={onClick} />);
    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('zeigt den Umschalter nur mit Handler', () => {
    const { unmount } = render(<SellAdviceRow player={player} advice={makeAdvice()} />);
    expect(screen.queryByRole('button', { name: /ausschließen/ })).not.toBeInTheDocument();
    unmount();

    render(<SellAdviceRow player={player} advice={makeAdvice()} onToggleExcluded={vi.fn()} />);
    expect(screen.getByRole('button', { name: /vom Verkauf ausschließen/ })).toBeInTheDocument();
  });

  it('schaltet aus, ohne die Zeile mitzuöffnen', async () => {
    const onClick = vi.fn();
    const onToggleExcluded = vi.fn();
    render(
      <SellAdviceRow
        player={player}
        advice={makeAdvice()}
        onClick={onClick}
        onToggleExcluded={onToggleExcluded}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /vom Verkauf ausschließen/ }));

    // In RN war das implizit (innerster Responder gewinnt); im DOM steckt es
    // in einem stopPropagation.
    expect(onToggleExcluded).toHaveBeenCalledWith(player);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('dreht Label und Zustand des Umschalters, wenn ausgeschlossen', () => {
    render(
      <SellAdviceRow
        player={player}
        advice={makeAdvice({ excluded: true })}
        onToggleExcluded={vi.fn()}
      />,
    );
    const toggle = screen.getByRole('button', { name: /wieder zum Verkauf freigeben/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});
