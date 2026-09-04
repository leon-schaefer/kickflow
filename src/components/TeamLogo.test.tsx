import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamLogo } from './TeamLogo';

describe('TeamLogo', () => {
  it('lädt das Logo als Bild — auch SVG, ohne CORS-Bedarf', () => {
    const { container } = render(<TeamLogo uri="https://kickbase.test/fcb.svg" />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', 'https://kickbase.test/fcb.svg');
    // Der Vereinsname steht überall daneben; ein alt-Text würde ihn doppeln.
    expect(img).toHaveAttribute('alt', '');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('zeigt ohne URL einen Platzhalter statt eines Bruchbilds', () => {
    const { container } = render(<TeamLogo uri={null} />);
    expect(container.querySelector('img')).toBeNull();
    // Der Platzhalter hält die Zeilenhöhe, damit sie beim Nachladen nicht springt.
    const placeholder = container.firstElementChild as HTMLElement;
    expect(placeholder.style.getPropertyValue('--logo-size')).toBe('20px');
  });

  it('nimmt die Größe vom Aufrufer', () => {
    const { container } = render(<TeamLogo uri="https://kickbase.test/x.png" size={14} />);
    expect(container.querySelector('img')!.style.getPropertyValue('--logo-size')).toBe('14px');
  });
});
