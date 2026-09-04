import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Setup für das `dom`-Projekt (jsdom). Siehe vitest.config.mts.
 */

/**
 * Pflicht, nicht Kosmetik: das Auto-Cleanup von @testing-library/react hängt
 * an einem globalen `afterEach`. Weil `globals` aus ist (die 29 bestehenden
 * Tests importieren describe/it/expect explizit), registriert es sich nicht
 * von selbst — ohne diese Zeile teilen sich alle Tests einer Datei ein DOM.
 */
afterEach(() => {
  cleanup();
});

/**
 * Ebenfalls Pflicht: nach der Umstellung der Speicher-Hooks liegen
 * Session-Token, letzte Liga, Aufstellungs-Regeln und Verkaufs-Ausschlüsse
 * alle im localStorage (siehe src/storage/keys.ts). Ohne Reset ist
 * Testreihenfolge-Abhängigkeit die wahrscheinlichste Flake-Quelle der Suite.
 */
beforeEach(() => {
  window.localStorage.clear();
});

/** jsdom kennt matchMedia nicht — gebraucht für prefers-reduced-motion. */
vi.stubGlobal(
  'matchMedia',
  (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList,
);

/**
 * jsdom kennt ResizeObserver nicht. Ohne Stub wirft jeder Test, der eine
 * messende Komponente mountet (useElementSize).
 *
 * Der Stub ruft die Callback bewusst NIE auf: die gemessene Größe bleibt
 * damit 0x0. Komponenten, die auf `width > 0` warten (MarketValueSparkline),
 * rendern in jsdom also ihren Leerzustand — genau richtig, denn Geometrie
 * gehört nicht hierher: sie ist in src/utils/chart.test.ts abgedeckt, und
 * echtes Layout prüft die Playwright-Runde. Ein Test, der doch eine Größe
 * braucht, mockt useElementSize gezielt.
 */
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

vi.stubGlobal(
  'IntersectionObserver',
  class {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: readonly number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  },
);

/** jsdom: "Not implemented" — u.a. vom Virtualizer und von Scroll-Containern. */
Element.prototype.scrollTo = () => {};

/**
 * jsdom hat kein Pointer-Capture. Gebraucht für das Touch-Scrubbing der
 * Sparkline, das Gesture.Pan ersetzt.
 */
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.hasPointerCapture = () => false;
