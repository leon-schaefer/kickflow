import { vi } from 'vitest';

/**
 * jsdom rechnet kein Layout: `offsetWidth`/`offsetHeight` sind immer 0 und
 * `getBoundingClientRect()` liefert eine Nullbox. Komponenten, die MESSEN,
 * sehen darin nichts und rendern ihren Leerzustand — der Virtualizer im
 * Spieler-Tab zeigt dann keine einzige Zeile, die Sparkline keinen Chart.
 *
 * Diese Hilfe stellt beiden eine Box. Was sie NICHT herstellt, ist echtes
 * Layout: welche Zeile bei welcher Scrollposition sichtbar ist oder wo ein
 * Punkt auf der Kurve landet, prüft sie nicht und kann sie nicht prüfen. Das
 * gehört auf ein echtes Gerät bzw. in die Playwright-Runde; hier geht es nur
 * darum, dass die messende Komponente überhaupt etwas zu messen hat.
 *
 * Bewusst pro Testdatei aufgerufen und nicht global in setup.ts: eine
 * app-weit erfundene Elementgröße würde Tests beeinflussen, die gar nichts
 * messen — und dort wäre die Ursache eines Fehlschlags nicht mehr zu sehen.
 */
export function fakeLayout({ width = 400, height = 600 } = {}): void {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => width,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => height,
  });

  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  });
}
