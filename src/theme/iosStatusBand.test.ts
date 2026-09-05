import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { layout } from './tokens';

/**
 * Wächter über den Abstand zum verschmierenden Band der iOS-PWA.
 *
 * Das Band ist die dritte Runde an derselben Stelle: erst zeichnete die App
 * randlos unter die Statusleiste, dann respektierte sie `env(safe-area-inset-
 * top)` — und beides war zu wenig, weil das Band rund 40pt TIEFER reicht als
 * die Safe Area. Der Rest liegt im Viewport und muss von der App selbst frei
 * gelassen werden; die Messung steht in der index.html.
 *
 * Genau wie base.css.test.ts prüft dieser Test deshalb Deklarationen und nicht
 * Verhalten: jsdom rechnet kein Layout, der Desktop-Browser zeigt kein
 * Symptom, und die einzige Umgebung, in der der Verlust sichtbar wird, ist ein
 * iPhone mit installierter PWA. Fällt eine der Regeln weg, ist der Titel
 * wieder verschmiert und niemand merkt es vor dem nächsten Screenshot.
 */
const SRC = path.join(import.meta.dirname, '..');
const HEADER = readFileSync(path.join(SRC, 'shell', 'AppHeader.module.css'), 'utf8');
const BANNER = readFileSync(
  path.join(SRC, 'components', 'UpdateBannerView.module.css'),
  'utf8',
);

const VAR = '--layout-ios-status-band-overhang';

/** Die beiden Bedingungen, die den Abstand auf die installierte iOS-PWA einengen. */
function guardedBlocks(css: string): string[] {
  // Grob, aber ausreichend: alles ab `@supports (-webkit-touch-callout` bis zum
  // Ende der Datei — beide Dateien haben genau einen solchen Block am Schluss.
  const start = css.indexOf('@supports (-webkit-touch-callout');
  return start === -1 ? [] : [css.slice(start)];
}

describe('Abstand zum iOS-Statusband', () => {
  it('kennt den ausgemessenen Überstand als Token', () => {
    // Der Wert selbst steht in tokens.ts und ist am Gerät gemessen (101pt
    // Bandunterkante minus ~62pt Viewport-Beginn). Hier nur festhalten, dass er
    // existiert und plausibel bleibt — eine 0 wäre der stille Rückfall.
    expect(layout.iosStatusBandOverhang).toBeGreaterThan(0);
  });

  it('schiebt die Kopfzeile um den Überstand nach unten', () => {
    const [block] = guardedBlocks(HEADER);
    expect(block, '@supports-Block fehlt in AppHeader.module.css').toBeDefined();
    expect(block).toContain('display-mode: standalone');
    expect(block).toContain(`var(${VAR})`);
    // Der Überstand ist ein Kandidat IM max(), keine Addition darauf: er ist
    // ein Mindestabstand von der Viewport-Kante. Addiert stand der Titel 8px
    // tiefer als nötig. Das Inset bleibt im Ausdruck, falls es je wiederkommt.
    expect(block).toMatch(/padding-top:\s*max\(/);
    expect(block).toContain('env(safe-area-inset-top)');
  });

  it('schiebt das Update-Banner um denselben Wert mit', () => {
    const [block] = guardedBlocks(BANNER);
    expect(block, '@supports-Block fehlt in UpdateBannerView.module.css').toBeDefined();
    expect(block).toContain('display-mode: standalone');
    expect(block).toContain(`var(${VAR})`);
    expect(block).toMatch(/top:\s*max\(/);
  });

  it('lässt den Abstand außerhalb der installierten iOS-PWA weg', () => {
    // Ohne eine der beiden Bedingungen bekämen Safari-Tab, Android-PWA und
    // Desktop eine 40px-Delle über der Kopfzeile — ein Fehler, den umgekehrt
    // nur der Desktop zeigt.
    for (const css of [HEADER, BANNER]) {
      const occurrences = css.split(`var(${VAR})`).length - 1;
      expect(occurrences).toBe(1);
      const [block] = guardedBlocks(css);
      expect(block).toContain(`var(${VAR})`);
    }
  });
});
