/**
 * Erzeugt src/theme/tokens.css aus src/theme/tokens.ts.
 *
 * Warum überhaupt zwei Darstellungen: CSS kann die TS-Konstanten nicht lesen,
 * und tokens.ts muss bleiben, weil Werte weiter in JS gebraucht werden —
 * SVG-Paint (Pitch, MarketValueSparkline), positionColors/statusColors als
 * Lookup, positionLabels/statusLabels als Daten.
 *
 * Warum generiert statt handgeschrieben: Duplizieren heißt Drift. Der
 * Generator macht die CSS-Datei zu einer Ableitung, `renderTokensCss()` ist
 * pur und wird von src/theme/tokens.css.test.ts gegen die eingecheckte Datei
 * geprüft — dieselbe Absicherung, die src/updates/registerSw.test.ts für das
 * duplizierte BUILD_ID_PATTERN leistet.
 *
 * Warum die Ausgabe trotzdem eingecheckt wird (statt Vite-Virtual-Module):
 * `var(--…)`-Autocomplete im Editor braucht eine echte Datei, Token-Änderungen
 * werden im Diff sichtbar, und Vitest/tsc brauchen keinen Build-Schritt.
 *
 *   npm run tokens
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { colors, layout, positionColors, radius, spacing, statusColors, typography } from '../src/theme/tokens';

/** camelCase -> kebab-case, damit die Var-Namen mechanisch aus den TS-Keys folgen. */
function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * Deckkraft-Variante einer Positionsfarbe. Der Wert `26` ist der Alpha-Suffix,
 * den die Screens heute per String-Konkatenation anhängen
 * (`${positionColors[position]}26`, siehe PlayerRowFrame/SellAdviceRow) —
 * bewusst wörtlich übernommen statt als `color-mix(… 15% …)` gerundet.
 */
function soft(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`Deckkraft-Variante braucht #RRGGBB, bekam: ${hex}`);
  }
  return `${hex}26`;
}

function block(title: string, lines: string[]): string {
  return [`  /* ${title} */`, ...lines.map((l) => `  ${l}`)].join('\n');
}

export function renderTokensCss(): string {
  const sections = [
    block(
      'colors',
      Object.entries(colors).map(([k, v]) => `--color-${kebab(k)}: ${v};`),
    ),
    block('positionColors — `-soft` ist die Hintergrundvariante (Alpha 0x26)', [
      ...Object.entries(positionColors).flatMap(([k, v]) => [
        `--pos-${k.toLowerCase()}: ${v};`,
        `--pos-${k.toLowerCase()}-soft: ${soft(v)};`,
      ]),
    ]),
    block(
      'statusColors',
      Object.entries(statusColors).map(([k, v]) => `--status-${kebab(k)}: ${v};`),
    ),
    block(
      'spacing',
      Object.entries(spacing).map(([k, v]) => `--space-${k}: ${v}px;`),
    ),
    block(
      'radius',
      Object.entries(radius).map(([k, v]) => `--radius-${k}: ${v}px;`),
    ),
    block(
      'layout',
      Object.entries(layout).map(([k, v]) => `--layout-${kebab(k)}: ${v}px;`),
    ),
    block('typography — Var-PAARE, keine Klassen (Begründung in tokens.css)', [
      ...Object.entries(typography).flatMap(([k, v]) => [
        `--font-size-${k}: ${v.fontSize}px;`,
        `--font-weight-${k}: ${v.fontWeight};`,
      ]),
    ]),
  ];

  return `/*
 * GENERIERT aus src/theme/tokens.ts — nicht von Hand editieren.
 * Neu erzeugen mit: npm run tokens
 * Abgesichert durch src/theme/tokens.css.test.ts (läuft in \`npm test\`).
 *
 * Die typography-Rollen stehen absichtlich als Var-PAARE
 * (--font-size-caption / --font-weight-caption) und nicht als fertige
 * Klassen: sie werden 179x gespreadet, oft mit nachträglichem
 * fontWeight-Override. Über CSS-Modules-\`composes\` würde dann die
 * Quellreihenfolge im Bundle darüber entscheiden, ob der Override greift.
 * Mit Var-Paaren schreibt die Regel ihr font-weight einfach selbst.
 *
 * Bewusst KEINE line-height-Tokens: RN setzt für diese fünf Rollen keine,
 * react-native-web erbt \`normal\`. Eine eingeführte line-height würde die
 * vertikale Rhythmik an 179 Stellen minimal verschieben — genau das, was den
 * Migrations-Diff unprüfbar macht.
 */
:root {
${sections.join('\n\n')}
}
`;
}

const OUT = path.join(import.meta.dirname, '..', 'src', 'theme', 'tokens.css');

if (import.meta.filename === process.argv[1]) {
  writeFileSync(OUT, renderTokensCss(), 'utf8');
  console.log(`tokens.css geschrieben: ${OUT}`);
}
