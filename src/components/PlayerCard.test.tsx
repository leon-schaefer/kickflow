import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { squadPlayer } from '@/test/squadPlayer';
import { statusLabels } from '@/theme/tokens';
import { PlayerCard } from './PlayerCard';

describe('PlayerCard', () => {
  it('zeigt Name, Ø-Punkte und die Position als Attribut', () => {
    const { container } = render(<PlayerCard player={squadPlayer()} />);

    expect(screen.getByText('Musiala')).toBeInTheDocument();
    // Vorher `backgroundColor: positionColors[player.position]` im JS.
    expect(container.querySelector('[data-position]')).toHaveAttribute('data-position', 'MID');
  });

  it('meldet den Spieler, nicht nur den Klick', async () => {
    const onClick = vi.fn();
    const player = squadPlayer();
    render(<PlayerCard player={player} onClick={onClick} />);

    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(player);
  });

  it('zeigt für „fit" keinen Statusring', () => {
    render(<PlayerCard player={squadPlayer({ status: 'fit' })} />);
    expect(screen.queryByRole('img', { name: statusLabels.fit })).not.toBeInTheDocument();
  });

  it('legt bei Ausfällen einen beschrifteten Ring über das Bild', () => {
    const { container } = render(<PlayerCard player={squadPlayer({ status: 'injured' })} />);

    // Der Ring trägt die Statusfarbe über data-status; der Punkt darin erbt
    // seine Farbe über --badge-color, ohne Farb-Prop.
    expect(container.querySelector('[data-status]')).toHaveAttribute('data-status', 'injured');
    expect(screen.getByRole('img', { name: statusLabels.injured })).toBeInTheDocument();
  });

  it('beschriftet das Kapitäns-C, statt es buchstabieren zu lassen', () => {
    render(<PlayerCard player={squadPlayer({ isCaptain: true })} />);
    expect(screen.getByRole('img', { name: 'Kapitän' })).toHaveTextContent('C');
  });

  it('zeigt das Kapitäns-C nur beim Kapitän', () => {
    render(<PlayerCard player={squadPlayer({ isCaptain: false })} />);
    expect(screen.queryByRole('img', { name: 'Kapitän' })).not.toBeInTheDocument();
  });

  it('hält das Bruchbild fern, wenn kein Bild da ist', () => {
    const { container } = render(<PlayerCard player={squadPlayer({ imageUrl: null })} />);
    expect(container.querySelector('img')).toBeNull();
  });
});
