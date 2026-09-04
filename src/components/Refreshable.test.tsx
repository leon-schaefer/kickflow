import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Refreshable } from './Refreshable';

/**
 * Die Zustandsmaschine von Pull-to-Refresh — vor dem Umzug völlig ungetestet,
 * obwohl es handgeschriebene Touch-Physik ist und der Port die Quelle der
 * Scrollposition getauscht hat (RN-`onScroll` mit `contentOffset.y` →
 * DOM-`scroll` mit `scrollTop`).
 *
 * Geprüft wird die Maschine, nicht das Gefühl: jsdom hat kein echtes
 * Touch-Modell und keine Passive-Semantik. Wie es sich anfühlt, gehört auf ein
 * echtes Gerät.
 */
const RESISTANCE = 0.5;
const THRESHOLD = 64;

/** Weg in Pixeln, der nach dem Widerstand `pull` ergibt. */
function dragFor(pull: number) {
  return pull / RESISTANCE;
}

function setup({ refreshing = false } = {}) {
  const onRefresh = vi.fn();
  const view = render(
    <Refreshable refreshing={refreshing} onRefresh={onRefresh}>
      {(p) => (
        <div {...p} data-testid="scroller">
          Inhalt
        </div>
      )}
    </Refreshable>,
  );
  const scroller = screen.getByTestId('scroller');
  // Der Wrapper trägt die Listener und die --pull-Property.
  const wrapper = scroller.parentElement!.parentElement!;
  return { onRefresh, wrapper, scroller, ...view };
}

function pull(wrapper: HTMLElement, distance: number, { release = true } = {}) {
  fireEvent.touchStart(wrapper, { touches: [{ clientY: 100 }] });
  fireEvent.touchMove(wrapper, { touches: [{ clientY: 100 + distance }] });
  if (release) fireEvent.touchEnd(wrapper, { touches: [] });
}

describe('Refreshable', () => {
  it('lädt neu, wenn über die Schwelle gezogen wurde', () => {
    const { onRefresh, wrapper } = setup();
    pull(wrapper, dragFor(THRESHOLD));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('lädt nicht neu, wenn die Schwelle nicht erreicht wurde', () => {
    const { onRefresh, wrapper } = setup();
    pull(wrapper, dragFor(THRESHOLD - 1));
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ignoriert einen Pull, während schon geladen wird', () => {
    const { onRefresh, wrapper } = setup({ refreshing: true });
    pull(wrapper, dragFor(THRESHOLD * 2));
    // Sonst würde ein zweiter Zug während des Ladens einen weiteren Refresh
    // anstoßen.
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ignoriert einen Pull, wenn der Inhalt nicht am obersten Rand steht', () => {
    const { onRefresh, wrapper, scroller } = setup();

    Object.defineProperty(scroller, 'scrollTop', { value: 120, configurable: true });
    fireEvent.scroll(scroller);

    pull(wrapper, dragFor(THRESHOLD * 2));
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('bricht ab, wenn die Geste nach oben geht', () => {
    const { onRefresh, wrapper } = setup();
    fireEvent.touchStart(wrapper, { touches: [{ clientY: 200 }] });
    fireEvent.touchMove(wrapper, { touches: [{ clientY: 150 }] });
    fireEvent.touchEnd(wrapper, { touches: [] });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ignoriert Mehrfingergesten', () => {
    const { onRefresh, wrapper } = setup();
    fireEvent.touchStart(wrapper, { touches: [{ clientY: 100 }, { clientY: 140 }] });
    fireEvent.touchMove(wrapper, { touches: [{ clientY: 400 }] });
    fireEvent.touchEnd(wrapper, { touches: [] });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('führt die Auslenkung als CSS-Variable und begrenzt sie', () => {
    const { wrapper } = setup();

    fireEvent.touchStart(wrapper, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(wrapper, { touches: [{ clientY: 160 }] });
    // 60px Weg * 0.5 Widerstand = 30
    expect(wrapper.style.getPropertyValue('--pull')).toBe('30');

    // Weit über MAX_PULL (96) hinaus ziehen.
    fireEvent.touchMove(wrapper, { touches: [{ clientY: 1000 }] });
    expect(wrapper.style.getPropertyValue('--pull')).toBe('96');
  });

  it('parkt den Inhalt beim Laden und fährt ihn danach zurück', () => {
    const onRefresh = vi.fn();
    const tree = (refreshing: boolean) => (
      <Refreshable refreshing={refreshing} onRefresh={onRefresh}>
        {(p) => <div {...p} data-testid="scroller" />}
      </Refreshable>
    );
    const { rerender } = render(tree(false));
    const wrapper = screen.getByTestId('scroller').parentElement!.parentElement!;

    pull(wrapper, dragFor(THRESHOLD));
    // Geparkt, solange geladen wird — der Indikator steht dann im Blickfeld.
    expect(wrapper.style.getPropertyValue('--pull')).toBe('48');

    // Der Aufrufer schaltet auf `refreshing`, sobald onRefresh die Queries
    // angestoßen hat, und wieder zurück, wenn sie fertig sind.
    rerender(tree(true));
    expect(wrapper.style.getPropertyValue('--pull')).toBe('48');

    rerender(tree(false));
    expect(wrapper.style.getPropertyValue('--pull')).toBe('0');
  });

  it('animiert nur während des Snaps, nicht während des Ziehens', () => {
    const { wrapper } = setup();

    fireEvent.touchStart(wrapper, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(wrapper, { touches: [{ clientY: 160 }] });
    // Eine dauerhafte Transition würde den Zug am Finger verschleppen.
    expect(wrapper).not.toHaveAttribute('data-snap');

    fireEvent.touchEnd(wrapper, { touches: [] });
    expect(wrapper).toHaveAttribute('data-snap', 'true');
  });
});
