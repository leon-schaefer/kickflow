import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CompetitionPlayer } from '@/api/kickbase';
import { CompetitionPlayerRow } from './CompetitionPlayerRow';

function makePlayer(overrides: Partial<CompetitionPlayer> = {}): CompetitionPlayer {
  return {
    id: '42',
    name: 'Musiala',
    position: 'MID',
    teamId: '2',
    marketValue: 10_000_000,
    marketValueTrend: 'up',
    totalPoints: 400,
    averagePoints: 120,
    valueScoreAvg: 12,
    valueScoreTotal: 40,
    status: 'fit',
    imageUrl: null,
    ...overrides,
  };
}

describe('CompetitionPlayerRow', () => {
  it('meldet den Spieler, nicht nur den Klick', async () => {
    const onClick = vi.fn();
    render(
      <CompetitionPlayerRow player={makePlayer()} metric="marketValue" onClick={onClick} />,
    );
    await userEvent.click(screen.getByText('Musiala'));
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: '42' }));
  });

  it('weicht bei Sortierung nach Marktwert auf Ø Punkte aus', () => {
    render(<CompetitionPlayerRow player={makePlayer()} metric="marketValue" />);
    // Eine zweite identische Zahl wäre Rauschen — deshalb steht unter dem
    // Marktwert die Ø-Punkte-Zelle.
    expect(screen.getByText('Ø Punkte')).toBeInTheDocument();
  });

  it('zeigt das Vereinslogo nur mit dem Vereinsnamen', () => {
    const { container } = render(
      <CompetitionPlayerRow
        player={makePlayer()}
        metric="marketValue"
        teamLogoUrl="https://kickbase.test/fcb.svg"
      />,
    );
    // Ohne teamName wäre das Logo bei fehlender Teamliste nur ein grauer Fleck.
    expect(container.querySelector('img')).toBeNull();
  });

  it('zeigt Logo und Verein, sobald der Name da ist', () => {
    const { container } = render(
      <CompetitionPlayerRow
        player={makePlayer()}
        metric="marketValue"
        teamName="FC Bayern"
        teamLogoUrl="https://kickbase.test/fcb.svg"
      />,
    );
    expect(screen.getByText('FC Bayern')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://kickbase.test/fcb.svg',
    );
  });

  it.each([
    [{ mine: true, onMarket: false }, 'Mein Kader'],
    [{ mine: false, onMarket: true }, 'Gelistet'],
  ])('markiert die Herkunft (%o)', (origin, label) => {
    render(
      <CompetitionPlayerRow player={makePlayer()} metric="marketValue" origin={origin} />,
    );
    // Bei ~500 Spielern ist das die Information, nach der man sucht.
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
