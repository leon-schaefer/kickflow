import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { colors } from '@/theme/tokens';

/**
 * Wächter über den HTML-Kopf der App.
 *
 * Der Kopf trägt drei mühsam erarbeitete Fixes, die jeweils mit einem
 * Begründungskommentar in der Datei stehen und alle drei stumm brechen, wenn
 * sie verschwinden:
 *
 *   1. `viewport-fit=cover` plus `apple-mobile-web-app-status-bar-style=
 *      black-translucent` — ohne das Paar melden die Safe-Area-Insets null:
 *      unten verschwindet das Padding der Tab-Bar, oben rutscht die Kopfzeile
 *      unter die durchscheinende Statusleiste.
 *   2. `maximum-scale=1, user-scalable=no` — Zoom bringt den Visual Viewport
 *      und das `100dvh`-Layout auseinander, sichtbar als weißer Balken unten.
 *   3. `100dvh` plus `background-color` auf html/body — Safari tönt seine
 *      Toolbars aus dem Body-Hintergrund, das `theme-color`-Meta allein
 *      genügt dafür nicht.
 *
 * Beim Umzug auf Vite wandert die Datei von `public/index.html` nach
 * `./index.html`, weil Vite die Root-HTML dort erwartet. Der Test prüft
 * deshalb den Inhalt und nicht den Ort — plus die Übergangsfalle, dass beide
 * Dateien gleichzeitig existieren.
 *
 * Muster: src/updates/registerSw.test.ts liest public/register-sw.js genauso
 * von der Platte.
 */
const ROOT = path.join(import.meta.dirname, '..', '..');
const AT_ROOT = path.join(ROOT, 'index.html');
const IN_PUBLIC = path.join(ROOT, 'public', 'index.html');

describe('index.html', () => {
  it('liegt an genau einem Ort', () => {
    const found = [AT_ROOT, IN_PUBLIC].filter((p) => existsSync(p));

    // Beide gleichzeitig ist die konkrete Cutover-Falle: Expo nutzt
    // public/index.html als Template UND kopiert public/* nach dist/ — der
    // Kopiervorgang würde Vites eigene Ausgabe überschreiben. Umgekehrt fällt
    // `expo export` bei nur ./index.html auf ein Default-Template zurück; der
    // Build bleibt grün und liefert ein falsches Artefakt.
    expect(found.map((p) => path.relative(ROOT, p))).toHaveLength(1);
  });

  const html = readFileSync(existsSync(AT_ROOT) ? AT_ROOT : IN_PUBLIC, 'utf8');

  it('lässt die App unter Notch und Home-Indicator zeichnen', () => {
    expect(html).toContain('viewport-fit=cover');
  });

  it('sperrt den Zoom, der das 100dvh-Layout zerreißt', () => {
    expect(html).toContain('maximum-scale=1');
    expect(html).toContain('user-scalable=no');
    expect(html).toContain('touch-action: manipulation');
  });

  it('bindet Manifest und Apple-PWA-Metas ein', () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('/manifest.webmanifest');
    expect(html).toContain('apple-touch-icon');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('apple-mobile-web-app-title');
    // `black-translucent`, nicht `black`: nur damit meldet `env(safe-area-inset-top)`
    // in der installierten iOS-PWA überhaupt einen Wert. Mit `black` bleibt der Inset
    // null, die Kopfzeile rutscht unter die durchscheinende Statusleiste und Titel wie
    // Zurück-Weg wirken verschwommen. Begründung steht ausführlich in der index.html.
    expect(html).toMatch(
      /apple-mobile-web-app-status-bar-style"?\s+content="black-translucent"/,
    );
  });

  it('färbt html/body in der Hintergrundfarbe aus den Tokens', () => {
    // Der Wert steht in der HTML hartkodiert, weil dort kein CSS-Import
    // greift — genau deshalb muss er gegen tokens.ts geprüft werden.
    expect(html.toLowerCase()).toContain(`background-color: ${colors.background.toLowerCase()}`);
    expect(html).toContain('100dvh');
  });

  it('verhindert das Rubber-Banding, das die Tab-Bar verschieben würde', () => {
    expect(html).toContain('overflow: hidden');
    expect(html).toContain('overscroll-behavior: none');
  });

  it('hat den Mount-Point und registriert den Service Worker', () => {
    expect(html).toContain('id="root"');
    expect(html).toContain('/register-sw.js');
  });
});
