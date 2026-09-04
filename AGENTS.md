# Vite + React Router, nicht React Native

kickflow ist eine reine React-SPA im Browser. `react-native`, `expo-*` und der
Ordner `app/` sind Restbestand der laufenden Migration: `app/**` ist aus dem
Typecheck genommen (`tsconfig.json`) und wird von nichts gebündelt. Neuer Code
gehört nach `src/`, als DOM und CSS-Module.

Vor dem Schreiben von Code die exakten versionierten Docs lesen:

- Vite 8 — https://vite.dev/config/
- React Router 8 — https://reactrouter.com/ (ein Paket, kein `react-router-dom`)

## Konventionen, die durchgehalten werden müssen

Die Begründung steht jeweils in der Datei selbst — dort nachlesen, bevor davon
abgewichen wird.

- **`src/theme/layout.module.css`**: Jede portierte Container-Regel trägt
  `composes: v` (Spalte) oder `composes: h` (Zeile). Das übersetzt die drei
  Defaults, in denen React Native und DOM auseinandergehen. `flex-direction`
  kommt in Komponenten-Modulen **nie** vor — Vite emittiert die komponierte
  Klasse nach der einbindenden Regel, ein Override würde also verlieren.
- **`src/theme/tokens.css` ist generiert** aus `src/theme/tokens.ts`
  (`npm run tokens`). Nicht von Hand editieren; `tokens.css.test.ts` prüft es.
- **Typografie** über die Var-Paare `--font-size-*` / `--font-weight-*`, nicht
  über fertige Klassen — aus demselben Reihenfolge-Grund.
- **Zustände** (aktiv, ausgewählt, deaktiviert) über `aria-*` bzw. `data-*` und
  Attribut-Selektoren, wo ein echtes Attribut passt (`aria-pressed`,
  `disabled`, `aria-current`). Für rein visuelle Varianten `cx` aus
  `src/utils/cx.ts`.
- **Safe-Area**: Header und Tab-Leiste brauchen `env(safe-area-inset-*)`
  explizit. Unter React Navigation kam das gratis; ohne die Regeln liegen sie in
  der installierten iOS-PWA unter Notch und Home-Indicator, ohne jedes Symptom
  im Desktop-Browser.
- **CSP**: `script-src 'self'` ohne `unsafe-inline`/`unsafe-eval` trägt die
  Argumentation für den Token im localStorage. Nichts einbauen, was Inline-
  Scripts oder `eval` braucht — siehe `vite.config.ts`
  (`modulePreload.polyfill: false`) und `src/app/zodConfig.ts`.
