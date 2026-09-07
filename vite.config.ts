import { readFileSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
// defineConfig aus 'vitest/config', nicht aus 'vite': nur diese Variante kennt den
// `test`-Block unten. Die Vite-Optionen sind identisch typisiert.
import { defineConfig, type Plugin } from 'vitest/config';
import { resolveShortGitSha } from './scripts/gitSha.ts';
import { resolveSiteOrigin } from './scripts/siteOrigin.ts';

/**
 * Vite-Konfiguration für die Web-Auslieferung — seit dem Cutover die einzige.
 *
 * `build:web` behält seinen Namen, weil `vercel.json` (buildCommand) und
 * `.github/workflows/pr.yml` daran hängen; nur sein Inhalt wechselte von
 * `expo export -p web` auf `vite build`. Das Ausgabeverzeichnis bleibt
 * `dist/` und deckt sich damit mit Vites Default.
 */

const pkg = JSON.parse(readFileSync(path.join(import.meta.dirname, 'package.json'), 'utf8')) as {
  version: string;
};

/**
 * Ersetzt `%SITE_ORIGIN%` im HTML-Kopf durch die eigene Herkunft.
 *
 * Vite ersetzt in der index.html von sich aus nur `%VITE_*%` aus den
 * Env-Variablen und lässt jeden anderen Platzhalter STEHEN. Das genügt hier
 * nicht: die Herkunft kommt im Deploy aus einer Vercel-Variablen ohne
 * `VITE_`-Präfix und braucht eine Normalisierung (siehe scripts/siteOrigin.ts).
 * Ein stehengebliebenes `%SITE_ORIGIN%` wäre außerdem der stille Fehler, den
 * die ganze Auflösung vermeiden soll — ein `og:image`, das keiner lädt.
 *
 * `order: 'pre'`, damit die Ersetzung vor Vites eigenem HTML-Durchlauf
 * passiert und dieser den Platzhalter gar nicht erst zu sehen bekommt.
 */
function siteOriginHtml(): Plugin {
  return {
    name: 'kickflow:site-origin-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replaceAll('%SITE_ORIGIN%', resolveSiteOrigin(process.env));
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), siteOriginHtml()],

  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },

  /**
   * Ersatz für expo-constants: `app.config.js` legte die verkürzte SHA als
   * `extra.gitSha` in die Expo-Config, `app.json` trug die Version. Beide
   * Dateien fallen beim Cutover weg.
   *
   * Die Version kommt jetzt aus package.json und damit aus EINER Quelle —
   * bisher stand sie doppelt (package.json und app.json), und nur app.json
   * erreichte die Oberfläche.
   */
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_SHA__: JSON.stringify(resolveShortGitSha()),
  },

  build: {
    /**
     * WICHTIG, sonst startet die App in Produktion nicht.
     *
     * Vite injiziert für den Modulepreload-Polyfill standardmäßig ein
     * INLINE-`<script>`. Die CSP in vercel.json erlaubt `script-src 'self'`
     * ohne `unsafe-inline` und ohne Hashes — das Script würde blockiert, je
     * nach Browser mit einem stillen Konsolen-Verstoß oder einem Bundle, das
     * gar nicht anläuft.
     *
     * Ohne Polyfill ignorieren ältere Browser die `modulepreload`-Hinweise
     * einfach (Safari kennt sie erst ab 17): langsamerer erster Load, kein
     * Funktionsverlust. Die Alternative — den Polyfill-Hash in die CSP
     * schreiben — würde die CSP an Vites Interna koppeln und bei jedem
     * Vite-Update brechen.
     */
    modulePreload: { polyfill: false },

    /**
     * Muss `assets` bleiben: public/sw.js behandelt genau diesen Pfad
     * cache-first, weil die Dateinamen dort einen Content-Hash tragen.
     *
     * Umgekehrt darf unter `public/` NIE ein Verzeichnis `assets/` entstehen —
     * dessen Inhalt landet unverändert in `dist/assets/` und würde vom Service
     * Worker als unveränderlich gecacht, obwohl er nicht gehasht ist. Ergebnis
     * wäre dauerhaft veralteter Inhalt für bestehende Installationen.
     */
    assetsDir: 'assets',
  },

  /**
   * Die Test-Konfiguration liegt hier und nicht in einer eigenen Datei, damit der
   * `@`-Alias genau einmal im Bundler-Kontext steht. Vorher gab es ihn doppelt
   * (tsconfig für Metro, vitest.config.mts für Vitest) — bei Drift reißen alle
   * `@/`-Importe.
   *
   * Zwei Projekte, getrennt nach Dateiendung. Warum nicht global jsdom: die Kosten
   * fallen pro DATEI an, und die Logik-Tests brauchen es nicht. Schwerer wiegt die
   * Semantik — src/updates/registerSw.test.ts injiziert `window`, `document` und
   * `fetch` als `new Function()`-Parameter, um public/register-sw.js isoliert
   * auszuführen. Mit einem echten globalen `window` daneben liefe der Test weiter
   * grün, würde aber nicht mehr auffallen, wenn der Code versehentlich das globale
   * `window` benutzt.
   *
   * Das Logik-Projekt nimmt neben `src/` auch `scripts/` auf. Der Build-Code dort
   * war bisher ungetestet, weil ihn kein `include` erfasste — und mit
   * scripts/siteOrigin.ts liegt dort jetzt Logik, deren Fehlerfall (eine falsche
   * Herkunft in den Open-Graph-Tags) im Browser unsichtbar bleibt.
   *
   * Die Trennung nach `.ts` vs. `.tsx` hält die bestehenden Logik-Tests unangetastet:
   * `src/**\/*.test.ts` matcht `foo.test.tsx` nicht. Jeder neue Komponententest heißt
   * `.test.tsx` und landet automatisch im jsdom-Projekt. Notausgang für ein
   * `.test.ts`, das doch DOM braucht: der Docblock `// @vitest-environment jsdom`.
   *
   * `globals` bleibt aus — die Tests importieren describe/it/expect explizit.
   * Konsequenz: das Auto-Cleanup von @testing-library/react hängt an einem globalen
   * `afterEach` und registriert sich damit NICHT; es steht von Hand in
   * src/test/setup.ts.
   *
   * `css` bleibt aus (Default). Damit dürfen Tests nicht auf
   * CSS-Modules-Klassennamen assertieren, sondern nur auf Rollen, Text und
   * Accessible Names — die haltbareren Assertions.
   */
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'logic',
          environment: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
  },
});
