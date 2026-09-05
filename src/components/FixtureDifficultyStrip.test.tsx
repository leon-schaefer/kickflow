import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FixtureDifficultyRating } from '@/utils/fixtureDifficulty';
import { difficultyStep, FixtureDifficultyStrip } from './FixtureDifficultyStrip';

function rating(overrides: Partial<FixtureDifficultyRating> = {}): FixtureDifficultyRating {
  return {
    day: 5,
    opponentId: '7',
    isHome: true,
    opponentLogoUrl: 'https://kickbase.test/bvb.svg',
    attackDifficulty: 0.5,
    defenseDifficulty: 0.5,
    ...overrides,
  };
}

describe('difficultyStep', () => {
  it.each([
    [0, 'easy'],
    [0.39, 'easy'],
    [0.4, 'neutral'],
    [0.6, 'neutral'],
    [0.61, 'hard'],
    [1, 'hard'],
  ])('stuft %s als %s ein', (value, step) => {
    // Die Schwellen sind aus der RN-Fassung unverändert übernommen.
    expect(difficultyStep(value)).toBe(step);
  });
});

describe('FixtureDifficultyStrip', () => {
  it('trägt die Härte als Attribut, nicht als Hex-String', () => {
    const { container } = render(
      <FixtureDifficultyStrip
        ratings={[rating({ attackDifficulty: 0.2 }), rating({ attackDifficulty: 0.9 })]}
        lens="attack"
      />,
    );
    // Vorher zwei Hilfsfunktionen mit `${colors.positive}26` — jetzt
    // data-difficulty + theme/positions.css.
    const cells = container.querySelectorAll('[data-difficulty]');
    expect([...cells].map((c) => c.getAttribute('data-difficulty'))).toEqual(['easy', 'hard']);
  });

  it('liest je Linse die andere Härte', () => {
    const ratings = [rating({ attackDifficulty: 0.1, defenseDifficulty: 0.9 })];

    const { container, unmount } = render(
      <FixtureDifficultyStrip ratings={ratings} lens="attack" />,
    );
    expect(container.querySelector('[data-difficulty]')).toHaveAttribute(
      'data-difficulty',
      'easy',
    );
    unmount();

    const defense = render(<FixtureDifficultyStrip ratings={ratings} lens="defense" />);
    expect(defense.container.querySelector('[data-difficulty]')).toHaveAttribute(
      'data-difficulty',
      'hard',
    );
  });

  it('zeigt ohne Logos nur H bzw. A', () => {
    const { container } = render(
      <FixtureDifficultyStrip ratings={[rating({ isHome: false })]} lens="attack" />,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    // Im Restprogramm wären 10 Logos zu klein, um erkennbar zu sein.
    expect(container.querySelector('img')).toBeNull();
  });

  it('füllt die Zelle mit dem Gegnerlogo, wenn gewünscht', () => {
    const { container } = render(
      <FixtureDifficultyStrip ratings={[rating()]} lens="attack" size={40} showOpponentLogos />,
    );
    const logo = container.querySelector('img')!;
    // 80 % der Zellengröße, gerundet.
    expect(logo.style.getPropertyValue('--logo-size')).toBe('32px');
    expect(screen.getByText('H')).toBeInTheDocument();
  });

  it('gibt die Zellengröße als Variable an die Reihe', () => {
    const { container } = render(
      <FixtureDifficultyStrip ratings={[rating()]} lens="attack" size={18} />,
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row.style.getPropertyValue('--cell-size')).toBe('18px');
  });
});
