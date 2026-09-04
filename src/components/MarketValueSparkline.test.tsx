import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketValuePoint } from '@/api/kickbase';
import { formatMarketValueDate } from '@/utils/format';
import { MarketValueSparkline } from './MarketValueSparkline';

/**
 * Getestet wird die Gestenschicht, nicht die Geometrie — die liegt
 * framework-frei in src/utils/chart.ts und ist dort abgedeckt.
 *
 * Zwei Dinge fehlen jsdom dafür, beide hier gestellt: eine gemessene Breite
 * (der ResizeObserver-Stub aus src/test/setup.ts feuert nie, also bleibt
 * useElementSize bei 0) und eine Bounding-Box.
 */
const CHART_WIDTH = 300;

vi.mock('@/hooks/useElementSize', () => ({
  useElementSize: () => [() => {}, { width: CHART_WIDTH, height: 120 }],
}));

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: CHART_WIDTH,
    bottom: 120,
    width: CHART_WIDTH,
    height: 120,
    toJSON: () => ({}),
  });
});

/**
 * Fünf Punkte: die Stützstellen liegen damit bei x = 0, 75, 150, 225, 300.
 * `date` ist eine Kickbase-Tagesnummer (siehe marketValueDate) — die Labels
 * kommen deshalb über formatMarketValueDate, nicht als geratener String.
 */
const points: MarketValuePoint[] = [
  { date: 20418, value: 10_000_000 },
  { date: 20419, value: 11_000_000 },
  { date: 20420, value: 12_000_000 },
  { date: 20421, value: 11_500_000 },
  { date: 20422, value: 13_000_000 },
];

/** Das Datumslabel des n-ten Punkts, so wie die Blase es zeigt. */
function labelOf(index: number) {
  return formatMarketValueDate(points[index]!.date);
}

function chartOf(container: HTMLElement) {
  // Der Knoten mit den Pointer-Handlern ist der Elternteil des SVG.
  return container.querySelector('svg')!.parentElement!;
}

function drag(chart: HTMLElement, from: number, to: number) {
  fireEvent.pointerDown(chart, { clientX: from, pointerId: 1 });
  fireEvent.pointerMove(chart, { clientX: to, pointerId: 1 });
}

describe('MarketValueSparkline', () => {
  it('zeigt bei weniger als zwei Punkten nur einen Platzhalter', () => {
    const { container } = render(<MarketValueSparkline points={points.slice(0, 1)} />);
    // Eine Linie aus einem Punkt gibt es nicht.
    expect(container.querySelector('svg')).toBeNull();
  });

  it('zeigt vor der ersten Geste keine Blase', () => {
    render(<MarketValueSparkline points={points} />);
    expect(screen.queryByText(/Mio/)).not.toBeInTheDocument();
  });

  it('scrubbt erst ab acht Pixeln waagerechtem Weg', () => {
    const { container } = render(<MarketValueSparkline points={points} />);
    const chart = chartOf(container);

    // Unter der Schwelle ist es ein Tippen, kein Ziehen — vorher
    // `activeOffsetX([-8, 8])`.
    drag(chart, 150, 154);
    expect(screen.queryByText(labelOf(2))).not.toBeInTheDocument();

    drag(chart, 150, 159);
    expect(screen.getByText(labelOf(2))).toBeInTheDocument();
  });

  it('wählt den Punkt, der dem Finger am nächsten liegt', () => {
    const { container } = render(<MarketValueSparkline points={points} />);
    const chart = chartOf(container);

    // x = 225 ist genau die vierte Stützstelle (Index 3).
    drag(chart, 100, 225);
    expect(screen.getByText(labelOf(3))).toBeInTheDocument();
  });

  it('nennt die Veränderung zum Vortag, aber nicht am ersten Punkt', () => {
    const { container } = render(<MarketValueSparkline points={points} />);
    const chart = chartOf(container);

    drag(chart, 100, 300);
    // Letzter Punkt: +1,5 Mio gegenüber dem vierten.
    expect(screen.getByText(/^\+/)).toBeInTheDocument();

    drag(chart, 100, 0);
    expect(screen.queryByText(/^[+−-]/)).not.toBeInTheDocument();
  });

  it('färbt die Veränderung über ein Attribut statt über eine Farbe im JS', () => {
    const { container } = render(<MarketValueSparkline points={points} />);
    const chart = chartOf(container);

    drag(chart, 100, 225);
    // Der vierte Punkt liegt unter dem dritten.
    expect(container.querySelector('[data-delta]')).toHaveAttribute('data-delta', 'down');
  });

  it('räumt die Blase weg, wenn der Browser das Scrollen übernimmt', () => {
    const { container } = render(<MarketValueSparkline points={points} />);
    const chart = chartOf(container);

    drag(chart, 100, 225);
    expect(screen.getByText(labelOf(3))).toBeInTheDocument();

    // `touch-action: pan-y` lässt den Browser senkrecht scrollen; er beendet
    // die Geste dann mit pointercancel. Das ist der Ersatz für failOffsetY.
    fireEvent.pointerCancel(chart, { pointerId: 1 });
    expect(screen.queryByText(labelOf(3))).not.toBeInTheDocument();
  });

  it('räumt die Blase weg, wenn der Finger geht', () => {
    const { container } = render(<MarketValueSparkline points={points} />);
    const chart = chartOf(container);

    drag(chart, 100, 225);
    fireEvent.pointerUp(chart, { pointerId: 1 });
    expect(screen.queryByText(labelOf(3))).not.toBeInTheDocument();
  });

  it('ignoriert Bewegung ohne vorheriges pointerdown', () => {
    const { container } = render(<MarketValueSparkline points={points} />);
    fireEvent.pointerMove(chartOf(container), { clientX: 225, pointerId: 1 });
    expect(screen.queryByText(labelOf(3))).not.toBeInTheDocument();
  });

  it.each([
    [points, 'up'],
    [[...points].reverse(), 'down'],
  ])('setzt die Trendfarbe als Attribut', (input, trend) => {
    const { container } = render(<MarketValueSparkline points={input} />);
    // Vorher ein `lineColor` in JS, das an drei SVG-Attribute ging.
    expect(container.querySelector('[data-trend]')).toHaveAttribute('data-trend', trend);
  });
});
