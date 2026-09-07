import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Wächter über den Reihenfolge-Vertrag von zodConfig.
 *
 * Zod v4 probiert `new Function` aus, um seine Validatoren zu kompilieren.
 * Die CSP erlaubt kein `eval`, der Versuch wird blockiert, Zod fängt die
 * Ausnahme ab — und der Browser meldet sie trotzdem als
 * `securitypolicyviolation`. `config({ jitless: true })` kürzt die Probe ab,
 * muss dafür aber laufen, BEVOR das erste Schema entsteht.
 *
 * Warum das ein Quelltext-Test ist und keine Verhaltensprüfung: der Verstoß
 * ist ausschließlich im echten Browser unter der echten CSP zu sehen. jsdom
 * kennt keine CSP, `npm test` bleibt grün, `npm run build:web` bleibt grün,
 * und die App funktioniert sogar — Zod läuft dann eben im Interpreter-Modus.
 * Sichtbar ist nur ein Konsoleneintrag pro Seitenaufruf. Das ist genau die
 * Art Regression, die niemand bemerkt: sie war schon einmal da, wurde
 * behoben, und kam mit dem Route-Splitting zurück, weil zod dabei in einen
 * geteilten Chunk wanderte, den der Browser vor dem Entry auswertet.
 *
 * Der Test prüft deshalb die Bedingung, die die Reihenfolge unabhängig von
 * der Chunk-Aufteilung garantiert: wer `z` benutzt, importiert die
 * Konfiguration selbst — und vorher.
 */
const SRC = path.join(import.meta.dirname, '..');

/** Jede .ts/.tsx-Datei unter src/, außer Tests. */
function sourceFiles(): string[] {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
    }
  }
  walk(SRC);
  return out;
}

describe('zodConfig', () => {
  const CONFIG_IMPORT = "import '@/app/zodConfig';";

  it('wird von JEDEM Modul importiert, das zod benutzt', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      if (file.endsWith(path.join('app', 'zodConfig.ts'))) continue;
      const source = readFileSync(file, 'utf8');
      if (!/^import .*from 'zod';$/m.test(source)) continue;
      if (!source.includes(CONFIG_IMPORT)) offenders.push(path.relative(SRC, file));
    }
    expect(
      offenders,
      'Diese Module bauen zod-Schemata, ohne vorher jitless zu setzen — im ' +
        'gebauten Artefakt kann ihr Chunk vor dem Entry laufen',
    ).toEqual([]);
  });

  it('steht in diesen Modulen VOR dem zod-Import', () => {
    // Die Reihenfolge im Quelltext ist die Auswertungsreihenfolge innerhalb
    // eines Moduls. Stünde der Konfigurations-Import darunter, liefe zods
    // Modulkörper zuerst — und das ist der Moment, in dem die Probe fällt.
    const wrongOrder: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(file, 'utf8');
      const configAt = source.indexOf(CONFIG_IMPORT);
      const zodAt = source.search(/^import .*from 'zod';$/m);
      if (configAt === -1 || zodAt === -1) continue;
      if (configAt > zodAt) wrongOrder.push(path.relative(SRC, file));
    }
    expect(wrongOrder).toEqual([]);
  });

  it('setzt jitless und nicht irgendeine andere Option', () => {
    const source = readFileSync(path.join(SRC, 'app', 'zodConfig.ts'), 'utf8');
    expect(source).toMatch(/config\(\{\s*jitless:\s*true\s*\}\)/);
  });

  it('bleibt auch im Entry gesetzt', () => {
    // Zusätzlich zu den Modulen oben: falls einmal direkt in einer Komponente
    // ein Schema entsteht, ist die Konfiguration trotzdem gesetzt.
    const main = readFileSync(path.join(SRC, 'main.tsx'), 'utf8');
    expect(main).toContain(CONFIG_IMPORT);
    // Und zwar vor allem anderen.
    expect(main.indexOf(CONFIG_IMPORT)).toBeLessThan(main.indexOf("from 'react'"));
  });
});
