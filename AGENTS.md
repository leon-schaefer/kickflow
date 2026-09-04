# Vite + React Router, nicht React Native

kickflow ist eine reine React-SPA im Browser. React Native und Expo sind
vollständig entfernt — kein `react-native`, kein `expo-*`, kein `app/`. Der
ganze Code liegt in `src/`: DOM-Elemente und CSS-Module.

Wer hier auf React-Native-Reste stößt (ein `StyleSheet.create`, ein `<View>`,
einen `expo-`Import), hat ein Stück gefunden, das übersehen wurde — es gehört
portiert, nicht ergänzt.

Vor dem Schreiben von Code die exakten versionierten Docs lesen:

- Vite 8 — https://vite.dev/config/
- React Router 8 — https://reactrouter.com/ (ein Paket, kein `react-router-dom`)

## Konventionen, die durchgehalten werden müssen

Die Begründung steht jeweils in der Datei selbst — dort nachlesen, bevor davon
abgewichen wird.

- **`src/theme/layout.module.css`**: Jede Container-Regel trägt `composes: v`
  (Spalte) oder `composes: h` (Zeile). Das ist kein Migrationsrest, sondern die
  Konvention: sie macht die Richtung an jeder Regel sichtbar, statt sie aus der
  Verschachtelung zu erraten. `flex-direction` kommt in Komponenten-Modulen
  **nie** vor — Vite emittiert die komponierte Klasse nach der einbindenden
  Regel, ein Override würde also verlieren.
- **`src/theme/base.css`** setzt `box-sizing: border-box` global. Die einzige
  globale Regel der App; die Begründung steht in der Datei.
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
  `style-src 'unsafe-inline'` muss dagegen BLEIBEN: die echt dynamischen Werte
  (Positionsfarben, Zellengrößen, Pull-Offset) sind Inline-`style`-Attribute
  und fielen sonst lautlos aus.
- **Modale** liegen per `createPortal` an `document.body` (siehe
  `src/components/Modal.tsx`). Nicht optional: die Touch-Listener von
  `Refreshable` hängen mit `capture` am Wrapper, und ein im Baum gerendertes
  Panel würde einen Wisch darin als Pull-to-Refresh im Hintergrund auslösen.
