import { describe, expect, it } from 'vitest';
import { colors, positionColors, statusColors, typography } from './tokens';

/**
 * Wächter über den Kontrast der Palette.
 *
 * Warum das ein Test ist und keine einmalige Prüfung: die Farben in tokens.ts
 * sind Zahlen, die niemand im Kopf nachrechnet. Drei von ihnen lagen unter der
 * AA-Schwelle, ohne dass es je auffiel — `textMuted` (3.36:1 auf der hellsten
 * Fläche), `danger`/`negative` (3.98:1) und `FWD` (4.04:1). Ein Auge sieht die
 * Differenz zwischen 4.1 und 4.6 nicht; ein Test schon.
 *
 * Geprüft wird gegen ALLE drei Flächen, nicht nur gegen `background`. Genau
 * daran lag der alte Fehler: auf dem dunkelsten Grund bestanden die Farben,
 * und die Fundstellen liegen überwiegend auf den beiden helleren (Karten sind
 * `surface`, Felder darin `surface-raised`). Welche Farbe auf welcher Fläche
 * landet, entscheidet CSS an rund 200 Stellen — der Test nimmt deshalb die
 * pessimistische Annahme „jede Vordergrundfarbe kann auf jeder Fläche
 * liegen" statt die Paarungen einzeln zu pflegen und dabei eine zu vergessen.
 *
 * Die Schwelle ist 4.5:1 (WCAG 2.2, Erfolgskriterium 1.4.3, Level AA) und
 * nicht die 3:1 aus 1.4.11 für Grafik. Begründung steht an den Tokens selbst:
 * jede hier geprüfte Farbe ist an mindestens einer Fundstelle `color:` auf
 * kleinem Text — und klein heißt hier wörtlich 11px (`small`) bis 15px
 * (`body`), also durchweg unter den 18pt/24px, ab denen die 3:1-Ausnahme für
 * großen Text überhaupt greifen würde. Der Test rechnet das unten nach, damit
 * die Schwelle nicht auf einer Behauptung steht.
 */

/** Alle Flächen, auf denen Text der App liegen kann. */
const SURFACES = {
  background: colors.background,
  surface: colors.surface,
  surfaceRaised: colors.surfaceRaised,
} as const;

const AA_NORMAL_TEXT = 4.5;

/**
 * Relative Luminanz nach WCAG 2.2, Definition „relative luminance".
 * Bewusst die Formel aus der Spezifikation und keine Bibliothek: es ist eine
 * Zeile Mathematik, und eine Dependency, die den Kontrast prüft, müsste selbst
 * geprüft werden.
 */
function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Erwartet #RRGGBB, bekam: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(match[1].slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrastverhältnis nach WCAG 2.2 — immer >= 1, Reihenfolge egal. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Jede Farbe, die irgendwo als `color:` auf Text landet.
 *
 * `border`, `pitch`, `pitchLine` und `accentMuted` fehlen absichtlich: das sind
 * ausschließlich Flächen und Linien, nie Text. `border` erreicht mit 1.2–1.5:1
 * nicht einmal die 3:1 aus 1.4.11 — auch das ist in Ordnung, denn ein
 * Kartenrand ist Dekoration und trägt keine Information: die Karte ist ohne
 * ihn genauso erkennbar (Hintergrundwechsel, Abstand, Überschrift). Wer border
 * zu einem informationstragenden Element macht, muss ihn hier aufnehmen.
 */
const TEXT_COLORS: Record<string, string> = {
  textPrimary: colors.textPrimary,
  textSecondary: colors.textSecondary,
  textMuted: colors.textMuted,
  accent: colors.accent,
  positive: colors.positive,
  negative: colors.negative,
  danger: colors.danger,
  // Positionskürzel: `var(--pos)` als `color` (PlayerRowFrame, SellAdviceRow,
  // PlayerFilterBar, PlayerDetailScreen).
  ...Object.fromEntries(Object.entries(positionColors).map(([k, v]) => [`pos.${k}`, v])),
  // Status-Icons zeichnen mit `currentColor` aus `--status-*` (StatusBadge).
  ...Object.fromEntries(Object.entries(statusColors).map(([k, v]) => [`status.${k}`, v])),
};

describe('Farbkontrast (WCAG 2.2 AA)', () => {
  it('trägt seine Information in Rollen, für die 4.5:1 gilt', () => {
    // Die 3:1-Ausnahme aus 1.4.3 gilt ab 18pt (24px) normal oder 14pt
    // (18.66px) fett. Genau EINE Rolle fällt darunter: `title` mit 22px/700.
    // Die anderen vier — `heading` (17px/600, also nicht fett im Sinne der
    // Regel), `body`, `caption`, `small` — sind normaler Text und verlangen
    // 4.5:1.
    //
    // Der Test unten prüft trotzdem alle Farben gegen 4.5:1 statt nach Rolle zu
    // unterscheiden, und das ist Absicht: eine Farbe weiß nicht, in welcher
    // Rolle sie landet. `textPrimary` trägt den Titel UND den Fließtext, und
    // welche Rolle eine Regel greift, steht in 200 CSS-Modulen. Eine Palette,
    // die überall 4.5:1 erreicht, macht die Frage gegenstandslos — die Palette
    // erreicht das, also kostet die strengere Schwelle hier nichts.
    const large: string[] = [];
    const normal: string[] = [];
    for (const [role, { fontSize, fontWeight }] of Object.entries(typography)) {
      const isLarge = fontSize >= 24 || (fontSize >= 18.66 && Number(fontWeight) >= 700);
      (isLarge ? large : normal).push(role);
    }
    // Wächter über die Begründung oben, nicht über die Palette: kämen weitere
    // große Rollen dazu, bliebe der Test unten richtig — nur dieser Kommentar
    // würde falsch.
    expect(large).toEqual(['title']);
    expect(normal).toEqual(['heading', 'body', 'caption', 'small']);
  });

  for (const [surfaceName, surface] of Object.entries(SURFACES)) {
    describe(`auf ${surfaceName} (${surface})`, () => {
      for (const [colorName, color] of Object.entries(TEXT_COLORS)) {
        it(`${colorName} erreicht ${AA_NORMAL_TEXT}:1`, () => {
          const ratio = contrastRatio(color, surface);
          expect(
            ratio,
            `${colorName} (${color}) auf ${surfaceName} (${surface}) = ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        });
      }
    });
  }

  it('hält die drei Textstufen unterscheidbar', () => {
    // Sonst ließe sich der Test oben trivial erfüllen, indem alle drei auf
    // textPrimary gesetzt werden — die Hierarchie primary > secondary > muted
    // ist der Grund, warum es drei sind.
    const primary = relativeLuminance(colors.textPrimary);
    const secondary = relativeLuminance(colors.textSecondary);
    const muted = relativeLuminance(colors.textMuted);
    expect(primary).toBeGreaterThan(secondary);
    expect(secondary).toBeGreaterThan(muted);
    // Und die Stufen müssen sichtbar auseinanderliegen, nicht nur messbar.
    expect(contrastRatio(colors.textSecondary, colors.textMuted)).toBeGreaterThan(1.2);
  });

  it('setzt lesbaren Text auf die Akzentfläche', () => {
    // Der Akzent ist an mehreren Stellen FLÄCHE mit Text darauf (Login-Button,
    // OfferModal-Bestätigung) — dort ist die Rechnung umgekehrt, und sie geht
    // nur mit dunklem Text auf: `background` erreicht 8.13:1, `textPrimary`
    // käme auf 2.18:1. Deshalb steht in beiden Regeln
    // `color: var(--color-background)`, und deshalb steht es hier.
    expect(contrastRatio(colors.background, colors.accent)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
    expect(contrastRatio(colors.textPrimary, colors.accent)).toBeLessThan(AA_NORMAL_TEXT);
  });
});
