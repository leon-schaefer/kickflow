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
  **nie** vor — nur `composes` bestimmt die Richtung.
  Die Basisregeln dort stehen alle in `:where()` und haben damit Spezifität 0.
  Das ist Pflicht, nicht Stil: Vite emittiert die komponierte Klasse **nach**
  der einbindenden Regel, bei gleicher Spezifität gewinnt also die Basis und
  die Komponente kann nichts überschreiben. Eine neue Basisregel ohne
  `:where()` entstellt still jede Komponente, die sie einbindet — nur
  `composes`-only-Regeln bleiben nackt, weil CSS Modules es so verlangt.
- **`src/theme/base.css`** ist die einzige globale Regelmenge der App:
  `box-sizing: border-box` und die **Schriftart** am `body`. Beides kam
  gratis von react-native-web (`<Text>` trug `font: '14px System'`) — ohne die
  Regel rendert der Browser Serifen. Begründung und Werte stehen in der Datei
  bzw. als `baseFont` in `tokens.ts`; `base.css.test.ts` hält es fest.
- **`src/theme/tokens.css` ist generiert** aus `src/theme/tokens.ts`
  (`npm run tokens`). Nicht von Hand editieren; `tokens.css.test.ts` prüft es.
- **Typografie** über die Var-Paare `--font-size-*` / `--font-weight-*`, nicht
  über fertige Rollen-Klassen: die Größe steht damit an der Fundstelle, und ein
  `font-weight`-Override daneben ist ohne Blick in eine Basisdatei lesbar.
- **Zustände** (aktiv, ausgewählt, deaktiviert) über `aria-*` bzw. `data-*` und
  Attribut-Selektoren, wo ein echtes Attribut passt (`aria-pressed`,
  `disabled`, `aria-current`). Für rein visuelle Varianten `cx` aus
  `src/utils/cx.ts`.
- **Safe-Area**: Die App zeichnet bewusst NICHT randlos — die `index.html` setzt
  kein `viewport-fit=cover` und `apple-mobile-web-app-status-bar-style=black`.
  Randlos legt iOS in der installierten PWA eine eigene Schicht über den oberen
  Rand, die alles darin verschmiert, und zwar rund 40pt tiefer als
  `env(safe-area-inset-top)` reicht — das Inset zu respektieren genügt dagegen
  nicht. Die ausgemessene Begründung steht in der `index.html`, bewacht von
  `indexHtml.test.ts`, das dort ausnahmsweise eine Abwesenheit prüft.
  Damit melden alle `env(safe-area-inset-*)` null. Header und Tab-Leiste tragen
  sie trotzdem weiter als `max(Design-Wert, env(…))`: der Ausdruck sagt
  „Systemleisten überlappen uns nie“ und stimmt in beiden Welten. Wer ihn als
  toten Code streicht, nimmt der nächsten Runde das Netz — im Desktop-Browser
  zeigt keine der beiden Welten ein Symptom.
  Weil das Band rund 40pt tiefer reicht als die Safe Area, ragt es auch in den
  so beschnittenen Viewport hinein. Kopfzeile und Update-Banner halten deshalb
  `--layout-ios-top-clearance` als Mindestabstand zur oberen Viewport-Kante
  ein, die Tab-Leiste `--layout-ios-bottom-clearance` zur unteren — jeweils als
  weiterer Kandidat IM `max()`, nicht als Aufschlag darauf: gebraucht wird ein
  Mindestabstand, kein Zuschlag auf einen Wert, der dasselbe schon leistet.
  In beiden Werten steckt ein Pflicht-Minimum (40px Bandunterkante oben, 34px
  Home-Indicator-Zone unten) plus Luft nach Augenmaß; `iosStatusBand.test.ts`
  hält nur die Minima fest, alles darüber darf sich ändern. Beides greift nur unter
  `@supports (-webkit-touch-callout: none)` und
  `@media (display-mode: standalone)`, also ausschließlich in der installierten
  iOS-PWA. Im Tab und auf anderen Plattformen gibt es weder Band noch
  Home-Indicator, dort wäre der Abstand eine Delle.
- **CSP**: `script-src 'self'` ohne `unsafe-inline`/`unsafe-eval` trägt die
  Argumentation für den Token im localStorage. Nichts einbauen, was Inline-
  Scripts oder `eval` braucht — siehe `vite.config.ts`
  (`modulePreload.polyfill: false`) und `src/app/zodConfig.ts`.
  `style-src 'unsafe-inline'` muss dagegen BLEIBEN: die echt dynamischen Werte
  (Positionsfarben, Zellengrößen, Pull-Offset) sind Inline-`style`-Attribute
  und fielen sonst lautlos aus.
  **Jedes Modul, das `z` aus zod benutzt, importiert vorher
  `@/app/zodConfig`** — nicht als Stilfrage: zod probiert sonst `new Function`
  aus, und der abgefangene Fehlschlag wird als CSP-Verstoß gemeldet. Der
  Import in `main.tsx` genügt dafür seit dem Route-Splitting NICHT mehr, weil
  ein geteilter Chunk vor dem Entry ausgewertet wird. `zodConfig.test.ts`
  bewacht es; sichtbar ist der Verstoß nur im echten Browser (jsdom hat keine
  CSP, Build und Tests bleiben grün).
- **Rechtsseiten** (`src/legal/`, `/datenschutz` und `/nutzungsbedingungen`)
  hängen ÖFFENTLICH im Route-Baum, außerhalb von `RequireAuth`. Das ist die
  Anforderung, nicht eine Bequemlichkeit: die Datenschutzerklärung muss lesbar
  sein, bevor jemand seine Kickbase-Zugangsdaten eintippt, und der Login-Fuß
  verlinkt sie. Verschiebt man sie hinter das Gate, leitet der Aufruf still
  auf den Login um — `src/legal/legalPages.test.tsx` hält es fest.
  Die Speicher-Tabelle der Datenschutzerklärung kommt aus
  `src/storage/inventory.ts` und ist per Test an `storage/keys.ts` gekoppelt:
  **ein neuer localStorage-Schlüssel bricht `npm test`, solange er dort nicht
  beschrieben ist.** Absicht — eine Rechtsseite, die still veraltet, ist der
  Schaden, den die Kopplung verhindert.
- **Generierte Dateien unter `public/`**: `build-id.txt`, `robots.txt` und
  `sitemap.xml` schreiben Build-Skripte (`scripts/write-build-id.ts`,
  `scripts/write-seo-files.ts`) und sind gitignored. Die robots.txt war einmal
  eingecheckt; generiert wird sie nur, weil die `Sitemap:`-Zeile eine absolute
  URL braucht — ihre Politik (`Allow: /`, keine Disallows) ist unverändert.
  Die Domain kommt für Sitemap UND Open-Graph-Tags aus derselben Quelle
  (`scripts/siteOrigin.ts`); zwei Auflösungen wären zwei Domains, die
  auseinanderlaufen.
- **Farbkontrast**: `theme/contrast.test.ts` rechnet jede Textfarbe der Palette
  gegen alle drei Flächen und verlangt 4.5:1 (WCAG 2.2 AA). Wer einen Token
  ändert, muss dort vorbei. Eine Schranke auf den maximalen Fehler ist
  übrigens der falsche Wächter für Farbbanding — die Begründung steht in
  `scripts/generate-icons.py`, wo Bilder als gedithertes 256-Farben-PNG
  gespeichert werden.
- **Geteilte Links** sind der einzige Weg, auf dem kickflow Nutzer findet —
  und alles daran bricht ausschließlich außerhalb des eigenen Browsers.
  `/` zeigt ohne Session die öffentliche Startseite, aber nur im Tab: in der
  installierten PWA ist `/` die `start_url` und führt weiter auf den Login
  (`src/routes/IndexRoute.tsx`). Die Open-Graph-Tags im HTML-Kopf bauen ihre
  URLs ABSOLUT aus `%SITE_ORIGIN%`, das ein Plugin in `vite.config.ts` zur
  Build-Zeit ersetzt (`scripts/siteOrigin.ts`); ein relativer Pfad ergibt eine
  Vorschaukarte ohne Bild, ohne dass irgendwo etwas ausfällt. Was auf der
  Startseite steht, muss die App auch können: der Text ist das Erste, was ein
  Fremder liest, und das Erste, was er nachprüft.
- **Modale** liegen per `createPortal` an `document.body` (siehe
  `src/components/Modal.tsx`). Nicht optional: die Touch-Listener von
  `Refreshable` hängen mit `capture` am Wrapper, und ein im Baum gerendertes
  Panel würde einen Wisch darin als Pull-to-Refresh im Hintergrund auslösen.
- **Rückkehr aus dem Hintergrund**: `src/pwa/resumeGuard.ts` hängt NEBEN React
  (aufgerufen unten in `main.tsx`, nicht in einer Komponente) und
  `src/pwa/stalledNotice.ts` baut seinen Hinweis mit `document.createElement`
  statt als Komponente. Beides ist der Sinn der Sache und kein Stilbruch: der
  Fall, für den die zwei Dateien da sind, ist eine PWA, in der React nach dem
  Auftauen nichts mehr rendert — eine React-Komponente wäre dort nie sichtbar.
  Die Messung (Transitions laufen über den einen `MessageChannel` des
  Schedulers, diskrete Taps über `queueMicrotask`) steht im Kopf von
  `resumeGuard.ts`. Wer das in React zurückholt, hat einen Wächter, der genau
  dann schläft, wenn er gebraucht wird — und im Desktop-Browser zeigt keine
  der beiden Fassungen ein Symptom.
  Neu geladen wird an allen drei Stellen (Update-Banner, Fehlerseite,
  Hinweis) ausschließlich auf Tap. Ein Auto-Reload würde einen ungespeicherten
  Aufstellungs-Entwurf wegwerfen.
- **Veraltete Chunks**: Die Screens hängen an `lazy()`, ihre Chunk-Namen tragen
  einen Content-Hash. Eine lange offene PWA kennt nach einem Deploy nur die
  alten Namen, der Import lehnt ab — und React Router legt seine
  Default-ErrorBoundary NUR um die Wurzel. Deshalb trägt die Wurzelroute ein
  `errorElement` (`src/routes/AppErrorScreen.tsx`); ohne es ersetzt ein
  fehlender Chunk die ganze App durch „Unexpected Application Error!" auf
  Englisch und ohne Weg zurück (`src/routes/staleChunk.test.tsx` stellt es am
  echten Baum nach).
