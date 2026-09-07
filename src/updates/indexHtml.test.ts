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

  /**
   * Die SEO- und Vorschau-Angaben.
   *
   * Warum die auch bewacht werden müssen, obwohl sie „nur Text" sind: die App
   * ist eine SPA. Unter `<div id="root">` steht nichts, bis das Bundle läuft —
   * ein Crawler und jeder Chat-Vorschau-Bot sehen AUSSCHLIESSLICH diesen Kopf.
   * Fällt eine Zeile hier weg, verschwindet die Beschreibung aus jedem
   * Suchergebnis und das Bild aus jeder geteilten Nachricht, und im Browser
   * zeigt nichts davon ein Symptom.
   */
  it('trägt Titel und Beschreibung für Suchergebnisse', () => {
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
    // Nicht bloß „kickflow": der Titel ist die Zeile im Suchergebnis und im
    // Lesezeichen und soll sagen, was die App tut.
    expect(title).toContain('kickflow');
    expect(title).toContain('Kickbase');

    // `\s` deckt auch den Zeilenumbruch — der Tag steht mehrzeilig
    // formatiert, weil die Beschreibung lang ist.
    const description =
      /<meta\s+name="description"\s+content="([^"]*)"/.exec(html)?.[1] ?? '';
    // Google schneidet Beschreibungen bei rund 155 Zeichen ab, zeigt aber
    // deutlich kürzere gar nicht erst — die Untergrenze fängt ein
    // versehentlich geleertes Attribut ab.
    expect(description.length).toBeGreaterThan(80);
    expect(description).toContain('Kickbase');
  });

  it('trägt die Open-Graph-Angaben samt Vorschaubild', () => {
    for (const property of [
      'og:type',
      'og:site_name',
      'og:locale',
      'og:title',
      'og:description',
      'og:image',
      'og:image:width',
      'og:image:height',
      'og:image:alt',
    ]) {
      expect(html, `${property} fehlt`).toContain(`property="${property}"`);
    }
    // Die Maße müssen zu dem passen, was scripts/generate-icons.py erzeugt:
    // 1200x630 ist das 1.91:1, das die Vorschau-Bots erwarten. Stimmen sie
    // nicht, reserviert der Bot den falschen Platz und beschneidet das Bild.
    expect(html).toContain('content="1200"');
    expect(html).toContain('content="630"');
    expect(html).toContain('content="/og-image.png"');
    // Ohne diese Zeile zeigt Twitter/X die kleine Karte mit quadratischem Bild.
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('summary_large_image');
  });

  it('bietet das Favicon als SVG UND als PNG an', () => {
    // SVG zuerst (skaliert scharf), PNG als Rückfall für Browser ohne
    // SVG-Favicon-Unterstützung. Die Reihenfolge entscheidet, welches ein
    // Browser nimmt, der beide kennt.
    const svgAt = html.indexOf('type="image/svg+xml"');
    const pngAt = html.indexOf('href="/favicon.png"');
    expect(svgAt).toBeGreaterThan(-1);
    expect(pngAt).toBeGreaterThan(-1);
    expect(svgAt).toBeLessThan(pngAt);
  });

  it('setzt KEINE geratene Domain', () => {
    // canonical und og:url ergänzt das Vite-Plugin `kickflow-absolute-meta-urls`
    // beim Build aus der Umgebung (siehe scripts/siteUrl.ts). Hier steht sie
    // absichtlich nicht: eine falsche kanonische URL weist Suchmaschinen auf
    // eine fremde Seite. Eine Abwesenheitsprüfung wie beim viewport-fit oben.
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('property="og:url"');
    // Und nirgends eine hartkodierte Deploy-Domain.
    expect(html).not.toMatch(/https:\/\/[a-z0-9-]+\.vercel\.app/);
  });

  it('hat den Mount-Point und registriert den Service Worker', () => {
    expect(html).toContain('id="root"');
    expect(html).toContain('/register-sw.js');
  });
});
