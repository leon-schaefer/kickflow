import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FixtureDifficultyRating } from '@/utils/fixtureDifficulty';
import { difficultyStep, fixtureLabel, FixtureDifficultyStrip } from './FixtureDifficultyStrip';

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

/**
 * Die Textalternative der Zellen.
 *
 * Der Streifen war die einzige Stelle der App, an der Information
 * ausschließlich über Farbe und Bild lief: die Härte steckte in der
 * Zellfarbe, der Gegner im Logo mit leerem `alt`. Für einen Screenreader war
 * eine Zeile damit zehnmal „H".
 *
 * Geprüft wird über `getByRole('img', { name })`, also über den
 * ACCESSIBLE NAME und nicht über den DOM-Text. Das ist hier der Unterschied,
 * auf den es ankommt: `getByText('H')` findet den Textknoten weiterhin, auch
 * wenn `role="img"` ihn für Hilfsmittel unsichtbar macht — ein Test darauf
 * wäre grün und würde nichts über die Vorlesbarkeit sagen.
 */
describe('fixtureLabel', () => {
  it('nennt Spieltag, Heimrecht und Härte in Worten', () => {
    expect(fixtureLabel({ day: 12, isHome: true }, 'hard', 'Bayern München')).toBe(
      'Spieltag 12, Heimspiel gegen Bayern München, schwer',
    );
    expect(fixtureLabel({ day: 3, isHome: false }, 'easy', 'VfB Stuttgart')).toBe(
      'Spieltag 3, Auswärtsspiel gegen VfB Stuttgart, leicht',
    );
    expect(fixtureLabel({ day: 7, isHome: true }, 'neutral', 'FC Köln')).toBe(
      'Spieltag 7, Heimspiel gegen FC Köln, mittel',
    );
  });

  it('lässt den Gegner weg, wenn kein Name bekannt ist', () => {
    // Eine Vereins-ID vorzulesen wäre keine Auskunft. Der Spielplan liefert
    // die Namen nicht mit — sie kommen aus der Competition-Tabelle, die nicht
    // jeder Aufrufer geladen hat.
    expect(fixtureLabel({ day: 5, isHome: false }, 'hard')).toBe(
      'Spieltag 5, Auswärtsspiel, schwer',
    );
  });

  it('deckt alle drei Stufen aus difficultyStep ab', () => {
    // Sonst könnte eine vierte Stufe dazukommen und als `undefined`
    // vorgelesen werden.
    for (const value of [0, 0.5, 1]) {
      const label = fixtureLabel({ day: 1, isHome: true }, difficultyStep(value));
      expect(label).not.toContain('undefined');
      expect(label).toMatch(/leicht|mittel|schwer$/);
    }
  });
});

describe('FixtureDifficultyStrip — Vorlesbarkeit', () => {
  it('gibt jeder Zelle einen Namen mit Gegner und Härte', () => {
    render(
      <FixtureDifficultyStrip
        ratings={[
          rating({ day: 12, isHome: true, opponentId: '7', attackDifficulty: 0.9 }),
          rating({ day: 13, isHome: false, opponentId: '9', attackDifficulty: 0.1 }),
        ]}
        lens="attack"
        opponentNames={new Map([
          ['7', 'Bayern München'],
          ['9', 'VfB Stuttgart'],
        ])}
      />,
    );

    expect(
      screen.getByRole('img', { name: 'Spieltag 12, Heimspiel gegen Bayern München, schwer' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Spieltag 13, Auswärtsspiel gegen VfB Stuttgart, leicht' }),
    ).toBeInTheDocument();
  });

  it('nennt die Härte auch ohne Namensliste', () => {
    // Die Härte ist die Kernaussage des Streifens und darf nie nur in der
    // Farbe stecken (WCAG 1.4.1) — auch dann nicht, wenn der Aufrufer keine
    // Vereinsnamen hat.
    render(<FixtureDifficultyStrip ratings={[rating({ day: 4 })]} lens="attack" />);
    expect(screen.getByRole('img', { name: /mittel$/ })).toBeInTheDocument();
  });

  it('liest das Logo NICHT zusätzlich vor', () => {
    // Das leere `alt` am Logo bleibt richtig: der Gegner steht schon im Label
    // der Zelle. Zwei Ansagen für dasselbe Bild wären schlechter als eine.
    const { container } = render(
      <FixtureDifficultyStrip
        ratings={[rating({ opponentId: '7' })]}
        lens="attack"
        showOpponentLogos
        opponentNames={new Map([['7', 'Bayern München']])}
      />,
    );
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    // Genau EIN benanntes Bild je Partie — die Zelle, nicht das Logo.
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });
});
