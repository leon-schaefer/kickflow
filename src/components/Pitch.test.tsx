import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { squadPlayer } from '@/test/squadPlayer';
import { Pitch } from './Pitch';
import pitchStyles from './Pitch.module.css';
import cardStyles from './PlayerCard.module.css';

const lineup = [
  squadPlayer({ id: 'gk', name: 'Neuer', position: 'GK', lineupSlot: 1 }),
  squadPlayer({ id: 'd2', name: 'Kimmich', position: 'DEF', lineupSlot: 3 }),
  squadPlayer({ id: 'd1', name: 'Tah', position: 'DEF', lineupSlot: 2 }),
  squadPlayer({ id: 'f1', name: 'Kane', position: 'FWD', lineupSlot: 4 }),
];

describe('Pitch', () => {
  it('ordnet die Reihen von vorn nach hinten', () => {
    render(<Pitch players={lineup} />);

    const names = screen.getAllByRole('button').map((b) => b.textContent);
    // FWD, MID (hier leer), DEF, GK — das Tor steht unten.
    expect(names[0]).toContain('Kane');
    expect(names[names.length - 1]).toContain('Neuer');
  });

  it('sortiert innerhalb einer Reihe nach lineupSlot', () => {
    render(<Pitch players={lineup} />);
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names.findIndex((n) => n?.includes('Tah'))).toBeLessThan(
      names.findIndex((n) => n?.includes('Kimmich')),
    );
  });

  it('lässt leere Reihen weg, statt Lücken zu zeichnen', () => {
    const { container } = render(<Pitch players={lineup} />);
    // Drei besetzte Positionen von vier — die Reihen kommen aus den echten
    // Spielern, nicht aus dem Formationsstring.
    expect(container.querySelectorAll(`.${pitchStyles.row}`)).toHaveLength(3);
  });

  it('gibt eine Auswahl nach oben durch', async () => {
    const onSelectPlayer = vi.fn();
    render(<Pitch players={lineup} onSelectPlayer={onSelectPlayer} />);

    await userEvent.click(screen.getByText('Kane'));
    expect(onSelectPlayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1' }));
  });

  it('zeichnet das Linienbild ohne Messung und blendet es für Screenreader aus', () => {
    const { container } = render(<Pitch players={lineup} />);
    const svg = container.querySelector('svg')!;

    // Feste viewBox statt onLayout-Pixel: 72x100 ist genau das aspect-ratio
    // 0.72 des Containers.
    expect(svg).toHaveAttribute('viewBox', '0 0 72 100');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('markiert vom Optimizer umgestellte Spieler — und nur die', () => {
    render(<Pitch players={lineup} changedIds={new Set(['f1'])} />);

    const kane = screen.getByText('Kane').closest('button')!;
    const neuer = screen.getByText('Neuer').closest('button')!;
    expect(kane).toHaveClass(cardStyles.changed);
    expect(neuer).not.toHaveClass(cardStyles.changed);
  });
});
