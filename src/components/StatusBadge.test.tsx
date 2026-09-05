import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { statusLabels } from '@/theme/tokens';
import { StatusBadge } from './StatusBadge';

/** Alle Status, die ein Badge tragen — `fit` fehlt absichtlich. */
const badgeStatuses = ['injured', 'doubtful', 'rehab', 'suspended', 'away', 'unknown'] as const;

describe('StatusBadge', () => {
  it('zeigt für „fit" nichts an', () => {
    const { container } = render(<StatusBadge status="fit" />);
    // Ein Hinweis auf "alles in Ordnung" ist keiner — das war schon in der
    // expo-symbols-Fassung so (statusIcons.fit war null).
    expect(container).toBeEmptyDOMElement();
  });

  it('beschriftet das Icon, damit die Bedeutung nicht nur grafisch vorliegt', () => {
    render(<StatusBadge status="injured" />);
    expect(screen.getByRole('img', { name: statusLabels.injured })).toBeInTheDocument();
  });

  it.each(badgeStatuses)('zeichnet ein SVG-Icon für %s', (status) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByRole('img', { name: statusLabels[status] });
    const svg = badge.querySelector('svg');
    expect(svg).not.toBeNull();
    // Nur der Wrapper trägt die Bedeutung; das SVG darin bleibt für
    // Screenreader unsichtbar, sonst läse es sich doppelt.
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('gibt jedem Status ein eigenes Icon — sonst wäre es wieder der Punkt', () => {
    // Der Grund für die Icons: sechs Status liefen vorher als sechs
    // identische Kreise, und injured/suspended tragen sogar dieselbe Farbe.
    const shapes = badgeStatuses.map((status) => {
      const { container } = render(<StatusBadge status={status} />);
      return container.querySelector('svg')!.innerHTML;
    });
    expect(new Set(shapes).size).toBe(badgeStatuses.length);
  });

  it('nimmt die Größe vom Aufrufer und trägt den Status als Attribut', () => {
    render(<StatusBadge status="injured" size={24} />);
    const badge = screen.getByRole('img');
    // Die Farbe kommt über data-status aus theme/positions.css, nicht per Prop.
    expect(badge).toHaveAttribute('data-status', 'injured');
    expect(badge.style.getPropertyValue('--badge-size')).toBe('24px');
    expect(badge.querySelector('svg')).toHaveAttribute('width', '24');
  });

  it('zeichnet mit currentColor, damit --badge-color/--status greifen', () => {
    const { container } = render(<StatusBadge status="away" />);
    const svg = container.querySelector('svg')!;
    expect(svg.innerHTML).toContain('currentColor');
    expect(svg.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('lässt die Farbe überschreiben — für Icons auf farbigem Grund', () => {
    render(<StatusBadge status="injured" color="#0B0F0C" />);
    expect(screen.getByRole('img').style.getPropertyValue('--badge-color')).toBe('#0B0F0C');
  });
})
