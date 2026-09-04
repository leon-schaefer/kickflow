import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Zwei Projekte, getrennt nach Dateiendung.
 *
 * Warum getrennt und nicht global jsdom: die Kosten von jsdom fallen pro
 * DATEI an, und die 29 bestehenden Logik-Tests brauchen es nicht. Schwerer
 * wiegt aber die Semantik — src/updates/registerSw.test.ts injiziert
 * `window`, `document` und `fetch` als `new Function()`-Parameter, um
 * public/register-sw.js isoliert auszuführen. Mit einem echten globalen
 * `window` daneben liefe der Test weiter grün, würde aber nicht mehr
 * auffallen, wenn der Code versehentlich das globale `window` benutzt. Der
 * Test verlöre still seine Schärfe.
 *
 * Warum nach `.ts` vs. `.tsx` und nicht nach Verzeichnis: die 29
 * bestehenden Dateien behalten `environment: 'node'` ohne eine einzige
 * Änderung und ohne Glob-Pflege. Jeder neue Komponententest heißt
 * `.test.tsx` und landet automatisch im richtigen Projekt.
 * (`src/**\/*.test.ts` matcht `foo.test.tsx` nicht — der Name muss auf
 * `.test.ts` enden.) Notausgang für ein `.test.ts`, das doch DOM braucht:
 * der Docblock `// @vitest-environment jsdom`.
 *
 * `environmentMatchGlobs` wäre der naheliegende Weg gewesen, ist in Vitest 4
 * aber entfernt.
 *
 * `globals` bleibt aus — die bestehenden Tests importieren describe/it/expect
 * explizit, und das anzutasten würde den Diff aufblasen. Konsequenz, die man
 * leicht übersieht: das Auto-Cleanup von @testing-library/react hängt an
 * einem globalen `afterEach` und registriert sich damit NICHT. Es steht
 * deshalb von Hand in src/test/setup.ts.
 *
 * `css` bleibt aus (Default). Damit dürfen Tests nicht auf
 * CSS-Modules-Klassennamen assertieren, sondern nur auf Rollen, Text und
 * Accessible Names — was ohnehin die haltbareren Assertions sind.
 *
 * Hinweis: Der `@`-Alias wandert mit dem Cutover in vite.config.ts, dann
 * fällt diese Datei weg. Bis dahin ist er hier die einzige Bundler-Quelle.
 */
const alias = {
  '@': path.resolve(import.meta.dirname, 'src'),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'logic',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
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
