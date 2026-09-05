import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useElementSize } from './useElementSize';

/**
 * Erster Test im `dom`-Projekt — prüft neben dem Hook auch, dass jsdom,
 * Testing Library und das Setup zusammenspielen.
 */

interface Observed {
  node: Element;
  emit: (width: number, height: number) => void;
  disconnected: boolean;
}

/** Ersetzt den No-op-Stub aus setup.ts durch einen steuerbaren Observer. */
function installObserver(): Observed[] {
  const observed: Observed[] = [];

  vi.stubGlobal(
    'ResizeObserver',
    class {
      /** Nur die Einträge DIESER Instanz — disconnect() darf nicht fremde treffen. */
      private readonly own: Observed[] = [];

      constructor(private readonly callback: ResizeObserverCallback) {}

      observe(node: Element) {
        const entry: Observed = {
          node,
          disconnected: false,
          emit: (width, height) => {
            this.callback(
              [{ contentRect: { width, height } } as ResizeObserverEntry],
              this as unknown as ResizeObserver,
            );
          },
        };
        this.own.push(entry);
        observed.push(entry);
      }

      unobserve() {}

      disconnect() {
        for (const entry of this.own) entry.disconnected = true;
      }
    },
  );

  return observed;
}

function Probe() {
  const [ref, size] = useElementSize();
  return (
    <div ref={ref} data-testid="box">
      {size.width}x{size.height}
    </div>
  );
}

/**
 * Wechselt den gemessenen Knoten — der Grund für den Ref-Callback.
 *
 * Die unterschiedlichen `key`s sind nötig, damit React die Zweige wirklich
 * aus- und neu einhängt. Ohne sie reconciliert React beide zum SELBEN
 * DOM-Knoten (gleicher Typ, gleiche Position) und ruft den Ref zu Recht nicht
 * erneut auf — dann prüfte der Test nichts.
 */
function SwitchingProbe() {
  const [showFirst, setShowFirst] = useState(true);
  const [ref, size] = useElementSize();
  return (
    <>
      <button type="button" onClick={() => setShowFirst(false)}>
        wechseln
      </button>
      {showFirst ? (
        <div key="first" ref={ref} data-testid="first" />
      ) : (
        <div key="second" ref={ref} data-testid="second" />
      )}
      <output>
        {size.width}x{size.height}
      </output>
    </>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useElementSize', () => {
  it('startet bei 0x0, solange nichts gemessen wurde', () => {
    installObserver();
    render(<Probe />);
    expect(screen.getByTestId('box')).toHaveTextContent('0x0');
  });

  it('beobachtet den Knoten, an dem der Ref hängt', () => {
    const observed = installObserver();
    render(<Probe />);

    expect(observed).toHaveLength(1);
    expect(observed[0]!.node).toBe(screen.getByTestId('box'));
  });

  it('übernimmt die gemeldete Größe und rundet auf ganze Pixel', async () => {
    const observed = installObserver();
    render(<Probe />);

    observed[0]!.emit(320.4, 160.6);

    // Subpixelwerte würden sonst bei jedem Layout einen neuen State und damit
    // eine Renderschleife auslösen.
    expect(await screen.findByText('320x161')).toBeInTheDocument();
  });

  it('beobachtet den neuen Knoten, wenn der gemessene wechselt', async () => {
    const observed = installObserver();
    render(<SwitchingProbe />);

    expect(observed).toHaveLength(1);
    expect(observed[0]!.node).toBe(screen.getByTestId('first'));

    await userEvent.click(screen.getByRole('button', { name: 'wechseln' }));

    // Genau das kann ein RefObject plus Effect nicht: der Effect läuft nicht
    // neu, wenn sich nur `ref.current` ändert. MarketValueSparkline hängt die
    // Messung an zwei Render-Zweigen — deshalb der Ref-Callback.
    expect(await screen.findByTestId('second')).toBeInTheDocument();
    expect(observed).toHaveLength(2);
    expect(observed[1]!.node).toBe(screen.getByTestId('second'));
    expect(observed[0]!.disconnected).toBe(true);
  });
});
