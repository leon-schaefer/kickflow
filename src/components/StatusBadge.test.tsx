import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { statusLabels } from '@/theme/tokens';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('zeigt für „fit" nichts an', () => {
    const { container } = render(<StatusBadge status="fit" />);
    // Ein Hinweis auf "alles in Ordnung" ist keiner — das war schon in der
    // expo-symbols-Fassung so (statusIcons.fit war null).
    expect(container).toBeEmptyDOMElement();
  });

  it('beschriftet den Punkt, damit die Bedeutung nicht nur in der Farbe steckt', () => {
    render(<StatusBadge status="injured" />);
    expect(screen.getByRole('img', { name: statusLabels.injured })).toBeInTheDocument();
  });

  it.each(['injured', 'doubtful', 'rehab', 'suspended', 'away', 'unknown'] as const)(
    'zeigt einen Punkt für %s',
    (status) => {
      render(<StatusBadge status={status} />);
      expect(screen.getByRole('img', { name: statusLabels[status] })).toBeInTheDocument();
    },
  );

  it('nimmt die Größe vom Aufrufer und trägt den Status als Attribut', () => {
    render(<StatusBadge status="injured" size={24} />);
    const dot = screen.getByRole('img');
    // Die Farbe kommt über data-status aus theme/positions.css, nicht per Prop.
    expect(dot).toHaveAttribute('data-status', 'injured');
    expect(dot.style.getPropertyValue('--badge-size')).toBe('24px');
  });

  it('lässt die Farbe überschreiben — für Punkte auf farbigem Grund', () => {
    render(<StatusBadge status="injured" color="#0B0F0C" />);
    expect(screen.getByRole('img').style.getPropertyValue('--badge-color')).toBe('#0B0F0C');
  });
})
