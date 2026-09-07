import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { layout } from './tokens';

/**
 * Wächter über die beiden Abstände zu den Systemkanten der iOS-PWA.
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
 * wieder verschmiert oder die Tab-Leiste sitzt wieder auf dem Home-Indicator,
 * und niemand merkt es vor dem nächsten Screenshot.
 */
const SRC = path.join(import.meta.dirname, '..');
const HEADER = readFileSync(path.join(SRC, 'shell', 'AppHeader.module.css'), 'utf8');
const BANNER = readFileSync(
  path.join(SRC, 'components', 'UpdateBannerView.module.css'),
  'utf8',
);
const TABBAR = readFileSync(path.join(SRC, 'shell', 'TabBar.module.css'), 'utf8');
/** Vierter Kandidat am oberen Rand: der Hinweis aus src/pwa/resumeGuard.ts. */
const STALLED = readFileSync(path.join(SRC, 'pwa', 'stalledNotice.module.css'), 'utf8');

const VAR = '--layout-ios-top-clearance';
const BOTTOM_VAR = '--layout-ios-bottom-clearance';

/*
 * Die harten Grenzen, unter die die Werte in tokens.ts nicht fallen dürfen.
 * Oben die am Screenshot ausgemessene Unterkante des Bandes (101pt ab
 * Bildschirmkante minus ~62pt Viewport-Beginn), unten die Zone, die Apple für
 * den Home-Indicator frei sehen will. Was darüber liegt, ist Geschmack und
 * darf sich ändern — das hier nicht.
 */
const MIN_TOP = 40;
const MIN_BOTTOM = 34;

/** Die beiden Bedingungen, die den Abstand auf die installierte iOS-PWA einengen. */
function guardedBlocks(css: string): string[] {
  // Grob, aber ausreichend: alles ab `@supports (-webkit-touch-callout` bis zum
  // Ende der Datei — beide Dateien haben genau einen solchen Block am Schluss.
  const start = css.indexOf('@supports (-webkit-touch-callout');
  return start === -1 ? [] : [css.slice(start)];
}

describe('Abstände zu den iOS-Systemkanten', () => {
  it('bleibt an beiden Kanten über dem Pflicht-Minimum', () => {
    // Die Werte in tokens.ts sind am Gerät eingestellt und dürfen das weiter
    // werden — aber nur nach oben. Wer sie unter diese Grenzen dreht, holt
    // das Schmieren bzw. den Home-Indicator zurück, und zwar unsichtbar für
    // jeden Desktop-Browser.
    expect(layout.iosTopClearance).toBeGreaterThanOrEqual(MIN_TOP);
    expect(layout.iosBottomClearance).toBeGreaterThanOrEqual(MIN_BOTTOM);
  });

  it('hält die Kopfzeile von der oberen Kante frei', () => {
    const [block] = guardedBlocks(HEADER);
    expect(block, '@supports-Block fehlt in AppHeader.module.css').toBeDefined();
    expect(block).toContain('display-mode: standalone');
    expect(block).toContain(`var(${VAR})`);
    // Der Abstand ist ein Kandidat IM max(), keine Addition darauf: er ist ein
    // Mindestabstand von der Viewport-Kante. Addiert stand der Titel 8px
    // tiefer als nötig. Das Inset bleibt im Ausdruck, falls es je wiederkommt.
    expect(block).toMatch(/padding-top:\s*max\(/);
    expect(block).toContain('env(safe-area-inset-top)');
  });

  it('hält das Update-Banner auf derselben Höhe', () => {
    const [block] = guardedBlocks(BANNER);
    expect(block, '@supports-Block fehlt in UpdateBannerView.module.css').toBeDefined();
    expect(block).toContain('display-mode: standalone');
    expect(block).toContain(`var(${VAR})`);
    expect(block).toMatch(/top:\s*max\(/);
  });

  /**
   * Der Hinweis, der ein eingefrorenes React meldet, sitzt an derselben
   * Stelle wie das Update-Banner — und wäre ohne den Abstand als einziges
   * Element wieder im Band. Er ist außerdem der Notausgang: unlesbar ist er
   * schlimmer als woanders.
   */
  it('hält den Stillstands-Hinweis auf derselben Höhe', () => {
    const [block] = guardedBlocks(STALLED);
    expect(block, '@supports-Block fehlt in stalledNotice.module.css').toBeDefined();
    expect(block).toContain('display-mode: standalone');
    expect(block).toContain(`var(${VAR})`);
    expect(block).toMatch(/top:\s*max\(/);
  });

  it('hält die Tab-Leiste vom Home-Indicator frei', () => {
    const [block] = guardedBlocks(TABBAR);
    expect(block, '@supports-Block fehlt in TabBar.module.css').toBeDefined();
    expect(block).toContain('display-mode: standalone');
    expect(block).toContain(`var(${BOTTOM_VAR})`);
    expect(block).toMatch(/padding-bottom:\s*max\(/);
    expect(block).toContain('env(safe-area-inset-bottom)');
  });

  it('lässt den Abstand außerhalb der installierten iOS-PWA weg', () => {
    // Ohne eine der beiden Bedingungen bekämen Safari-Tab, Android-PWA und
    // Desktop eine Delle über der Kopfzeile bzw. unter der Tab-Leiste — ein
    // Fehler, den umgekehrt nur der Desktop zeigt.
    for (const [css, name] of [
      [HEADER, VAR],
      [BANNER, VAR],
      [STALLED, VAR],
      [TABBAR, BOTTOM_VAR],
    ] as const) {
      const occurrences = css.split(`var(${name})`).length - 1;
      expect(occurrences).toBe(1);
      const [block] = guardedBlocks(css);
      expect(block).toContain(`var(${name})`);
    }
  });
});
