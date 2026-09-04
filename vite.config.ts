import { readFileSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolveShortGitSha } from './scripts/gitSha';

/**
 * Vite-Konfiguration für die Web-Auslieferung.
 *
 * Noch nicht scharf: `build:web` ruft weiter `expo export -p web`. Diese
 * Datei existiert vorab, damit der Cutover ein reiner Script-Wechsel ist und
 * nicht gleichzeitig neue Konfiguration einführt.
 */

const pkg = JSON.parse(readFileSync(path.join(import.meta.dirname, 'package.json'), 'utf8')) as {
  version: string;
};

export default defineConfig({
  plugins: [react()],

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
});
