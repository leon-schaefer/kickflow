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
 *   1. KEIN `viewport-fit=cover` plus `apple-mobile-web-app-status-bar-style=
 *      black` — dieses Paar hält die App aus dem Bereich heraus, den iOS in
 *      der installierten PWA mit einer eigenen, verschmierenden Schicht
 *      belegt. Beide Werte sind schon einmal andersherum dagewesen; deshalb
 *      prüft der Test hier eine ABWESENHEIT, was er sonst nirgends tut.
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

  /**
   * Nur der `content`-Wert des viewport-Metas, nicht die ganze Datei.
   *
   * Nötig, seit die Prüfung darunter eine Abwesenheit ist: die Begründung für
   * das fehlende `viewport-fit=cover` steht als Kommentar direkt über dem Tag
   * und nennt den Wert mehrfach beim Namen. Ein `not.toContain` über das
   * Dokument fiele darüber und wäre nur noch grün, solange niemand die
   * Begründung aufschreibt.
   */
  const viewportMeta = /<meta\s+name="viewport"\s+content="([^"]*)"/.exec(html)?.[1] ?? '';

  it('zeichnet NICHT unter Notch und Home-Indicator', () => {
    expect(viewportMeta).not.toBe('');
    // Absichtlich eine Abwesenheit: `viewport-fit=cover` schiebt die App unter
    // die Statusleiste, und dort legt iOS in der installierten PWA eine
    // gerasterte Schicht über den oberen Rand — rund 40pt tiefer, als die Safe
    // Area reicht. Alles darin wird verschmiert, auch was das Inset korrekt
    // respektiert. Die ausgemessene Begründung steht in der index.html.
    expect(viewportMeta).not.toContain('viewport-fit');
  });

  it('sperrt den Zoom, der das 100dvh-Layout zerreißt', () => {
    expect(viewportMeta).toContain('maximum-scale=1');
    expect(viewportMeta).toContain('user-scalable=no');
    expect(html).toContain('touch-action: manipulation');
  });

  it('bindet Manifest und Apple-PWA-Metas ein', () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('/manifest.webmanifest');
    expect(html).toContain('apple-touch-icon');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('apple-mobile-web-app-title');
    // `black`, nicht `black-translucent`: der translucent-Wert zwingt den Inhalt unter
    // die Statusleiste, unabhängig vom viewport-fit oben — und damit unter die Schicht,
    // die ihn verschmiert. Gehört mit der Prüfung auf das fehlende `viewport-fit=cover`
    // zusammen; einer der beiden allein genügt nicht.
    expect(html).toMatch(/apple-mobile-web-app-status-bar-style"?\s+content="black"/);
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
