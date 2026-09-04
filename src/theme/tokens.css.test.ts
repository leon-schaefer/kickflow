import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderTokensCss } from '../../scripts/generate-tokens-css';
import {
  baseFont,
  colors,
  layout,
  positionColors,
  radius,
  spacing,
  statusColors,
  typography,
} from './tokens';

/**
 * Wächter über die Duplizierung zwischen tokens.ts und tokens.css.
 *
 * tokens.css ist generiert (scripts/generate-tokens-css.ts), aber eingecheckt —
 * ohne diesen Test würde ein Token-Wechsel in tokens.ts still an der CSS-Seite
 * vorbeigehen und die Oberfläche mit alten Werten weiterlaufen. Vorbild ist
 * src/updates/registerSw.test.ts, das dasselbe für das in register-sw.js
 * duplizierte BUILD_ID_PATTERN tut.
 */
const CSS = readFileSync(path.join(import.meta.dirname, 'tokens.css'), 'utf8');

describe('tokens.css', () => {
  it('ist der aktuelle Generator-Output (sonst: npm run tokens)', () => {
    expect(CSS).toBe(renderTokensCss());
  });

  it('führt jede Farbe aus tokens.ts als Custom Property', () => {
    for (const [key, value] of Object.entries(colors)) {
      const name = `--color-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
      expect(CSS, `${name} fehlt oder weicht ab`).toContain(`${name}: ${value};`);
    }
  });

  it('führt zu jeder Positionsfarbe die Deckkraft-Variante', () => {
    for (const [key, value] of Object.entries(positionColors)) {
      const base = `--pos-${key.toLowerCase()}`;
      expect(CSS).toContain(`${base}: ${value};`);
      // Alpha 0x26 — derselbe Suffix, den die Screens heute anhängen.
      expect(CSS).toContain(`${base}-soft: ${value}26;`);
    }
  });

  it('führt jeden Statusfarbwert', () => {
    for (const [key, value] of Object.entries(statusColors)) {
      expect(CSS).toContain(`--status-${key}: ${value};`);
    }
  });

  it('führt Abstände, Radien und Layout in px', () => {
    for (const [key, value] of Object.entries(spacing)) {
      expect(CSS).toContain(`--space-${key}: ${value}px;`);
    }
    for (const [key, value] of Object.entries(radius)) {
      expect(CSS).toContain(`--radius-${key}: ${value}px;`);
    }
    expect(CSS).toContain(`--layout-max-content-width: ${layout.maxContentWidth}px;`);
  });

  it('führt jede typography-Rolle als Var-Paar', () => {
    for (const [key, role] of Object.entries(typography)) {
      expect(CSS).toContain(`--font-size-${key}: ${role.fontSize}px;`);
      expect(CSS).toContain(`--font-weight-${key}: ${role.fontWeight};`);
    }
  });

  it('führt Schriftfamilie und Erbgröße', () => {
    expect(CSS).toContain(`--font-family-base: ${baseFont.fontFamily};`);
    expect(CSS).toContain(`--font-size-base: ${baseFont.fontSize}px;`);
  });

  it('setzt bewusst keine line-height (siehe Kommentar in tokens.css)', () => {
    // Auf die Deklaration prüfen, nicht auf das Wort: der Kopfkommentar der
    // Datei begründet genau diese Entscheidung und nennt sie dabei.
    expect(CSS).not.toMatch(/^\s*(--)?line-height\s*:/m);
  });
});
