# kickflow

Kickbase-Companion als React-SPA (Vite + React Router), ausgeliefert
**ausschließlich als Web-App/PWA** über Vercel. Diese README beschreibt
Entwicklung und Deployment.

Warum keine Store-App: kickflow zeigt Inhalte von Kickbase an (Marktwerte,
Kader, Vereinslogos) und meldet sich mit dem Kickbase-Konto des Nutzers an.
Apple verlangt bei der Einreichung die Rechte an genau diesen Inhalten, und
eine Genehmigung von Kickbase gibt es nicht. Die native Auslieferung — EAS,
TestFlight, OTA-Updates, Fingerprint — ist deshalb komplett entfernt.

## Entwicklung

```bash
npm run dev          # Vite Dev-Server
npm run preview      # gebautes dist/ lokal servieren
npm run tokens       # src/theme/tokens.css aus tokens.ts neu erzeugen
npm test             # Vitest
npm run typecheck    # tsc --noEmit
npm run probe        # Kickbase-API-Explorer, braucht .env.local
```

`npm run probe` spricht mit einem echten Konto und dumpt Rohantworten nach
`scripts/.probe-output/` (git-ignoriert). Zugangsdaten dafür in `.env.local`,
Vorlage in `.env.local.example`.

Ohne Flag liest der Probe nur. Die Flags `--save-lineup`, `--offers` und
`--list-player` SCHREIBEN dagegen in der echten Liga (Aufstellung speichern,
Gebot abgeben, Spieler auf den Markt stellen) — jeweils so, dass der
Ausgangszustand danach wiederhergestellt ist. Scheitert das Aufräumen, sagt
der Probe das laut; dann in der Kickbase-App nachsehen.

## Branches

`main` ist der Default-Branch und damit das, was Vercel nach Production
deployt; `develop` ist der Integrationsbranch, aus dem heraus nach `main`
gemerged wird. Beide Workflows filtern genau auf diese zwei Namen
(`pull_request` gegen `develop` und `main`), Vercel leitet Production vs.
Preview aus dem Default-Branch ab. Feature-Branches hängen darunter und sind
Wegwerfware.

Deshalb dürfen `main` und `develop` nicht gelöscht werden — und genau das ist
schon passiert. GitHubs "Automatically delete head branches" löscht nach einem
Merge den Head-Branch des Pull Requests. Bei einem Feature-Branch ist das der
Sinn der Einstellung, bei PR #22 (`develop` -> `main`) war der Head aber
`develop`. Der Branch war danach weg, während beide Workflows weiter auf ihn
filterten.

Der Schutz dagegen ist ein Ruleset mit der Regel `deletion` auf
`refs/heads/main` und `refs/heads/develop`. Ein Branch, den ein Ruleset gegen
Löschen schützt, wird von der Automatik übersprungen — das Aufräumen der
Feature-Branches bleibt also an, nur diese zwei sind ausgenommen. Der
Repo-Schalter wäre das gröbere Werkzeug: er würde alles stehen lassen. Und das
Ruleset deckt zusätzlich das Löschen von Hand ab, in der UI wie über die API.

Erzwingen lässt sich das nur GitHub-seitig, im Repository liegt nur die
Vorlage. `.github/rulesets/protected-branches.json` ist die Quelle,
`scripts/protect-branches.sh` schreibt sie über die API:

```bash
scripts/protect-branches.sh            # Ruleset anlegen oder aktualisieren
scripts/protect-branches.sh --check    # nur berichten, nichts ändern
```

Braucht `gh` (eingeloggt, Admin-Rechte) und `jq`. Änderungen gehören in das
JSON, nicht in die GitHub-UI: das Skript schreibt per `PUT` und überschreibt
dabei, was dort von Hand verstellt wurde.

Ein Haken bleibt: Rulesets werden auf einem **privaten** Repo erst ab GitHub
Pro durchgesetzt. Auf Free lässt sich das Ruleset anlegen, es greift aber
nicht — `--check` zeigt es dann als `active`, ohne dass es etwas verhindert.
Ohne Pro bleibt nur der Repo-Schalter:

```bash
scripts/protect-branches.sh --disable-auto-delete
```

Danach bleiben auch die Feature-Branches nach dem Merge stehen und müssen von
Hand weg. Der Tausch ist trotzdem richtig: ein verlorener `develop` kostet
mehr als ein bisschen Aufräumen.

Wenn doch mal einer der beiden fehlt, ist er nicht verloren, solange der
Commit noch über `main` erreichbar ist:

```bash
git push origin <sha>:refs/heads/develop
```

## Deployment

Vercel deployt über die Git-Integration, die Konfiguration steht komplett in
`vercel.json`:

| Schlüssel | Wert |
| --- | --- |
| `buildCommand` | `npm run build:web` |
| `outputDirectory` | `dist` |
| `rewrites` | `/:path*` → `/` |

`npm run build:web` macht drei Dinge: `scripts/write-build-id.ts` schreibt
`public/build-id.txt`, `scripts/write-seo-files.ts` schreibt `public/robots.txt`
und (nur in Production, siehe unten) `public/sitemap.xml`, dann baut
`vite build` nach `dist/`. Alles unter `public/` (Manifest, Service Worker,
Icons, Favicon, Vorschaubild, Build-ID, robots/sitemap) kopiert Vite
unverändert mit, `index.html` im Projekt-Root ist der Einstieg.

Alle drei generierten Dateien sind gitignored: ihr Inhalt hängt an der
Umgebung, nicht am Quelltext.

Der Script-NAME ist festgenagelt: `vercel.json` (`buildCommand`) und
`.github/workflows/pr.yml` rufen ihn so auf. Unter `public/` darf außerdem nie
ein Verzeichnis `assets/` entstehen — das kollidiert mit Vites Ausgabepfad und
landet im Service Worker als unveränderlich gecachter Inhalt ohne Hash.

Der Catch-All-Rewrite ist zwingend: es gibt nur eine `index.html` und keine
Datei pro Route, das Routing macht React Router im Browser
(`src/routes/routes.tsx`). Nebenwirkung, auf die der Update-Check unten
Rücksicht nimmt: eine fehlende Datei liefert nicht 404, sondern `index.html`
mit Status 200.

`vercel.json` setzt außerdem CSP und Security-Header. Die CSP erlaubt
ausdrücklich `api.kickbase.com` (die App spricht die Kickbase-API direkt aus
dem Browser, ohne Proxy) und `kickbase.b-cdn.net` für Logos und Spielerbilder.
`script-src 'self'` ohne `unsafe-inline`/`unsafe-eval` — das ist der Grund,
warum der Token im localStorage vertretbar ist (`src/auth/tokenStore.ts`).

Zwei Dinge hängen daran und dürfen nicht verloren gehen:
`build.modulePreload.polyfill` ist in `vite.config.ts` **aus** (Vite würde
sonst ein Inline-`<script>` injizieren), und `src/app/zodConfig.ts` schaltet
Zods JIT-Kompilierung ab (Zod prüft sonst per `new Function`, ob eval erlaubt
ist, und der abgefangene Fehler wird trotzdem als CSP-Verstoß gemeldet).

Beim zweiten Punkt kommt es auf die Reihenfolge an, und der Import in
`main.tsx` allein reicht dafür nicht mehr: seit die Screens per `lazy()`
gesplittet sind, legt Rolldown zod in einen GETEILTEN Chunk, und den wertet der
Browser vor dem Body des Entry-Chunks aus — `config({ jitless: true })` liefe
also nach dem ersten Schema. Deshalb importiert **jedes Modul, das `z`
benutzt**, `@/app/zodConfig` selbst und vor zod (`schemas.ts`, `rules.ts`,
`excludedFromSale.ts`). `src/app/zodConfig.test.ts` bewacht das. Nachprüfbar
ist der Verstoß nur im echten Browser unter der echten CSP — der Deep-Link-Lauf
unten sammelt ihn über `securitypolicyviolation`.

### Kanonische Domain (`SITE_URL`)

Vier Angaben brauchen eine absolute URL und können sie nicht zur Laufzeit
bilden: `<link rel="canonical">`, `og:url`, `og:image` und die
`Sitemap:`-Zeile in der robots.txt. Die Domain kommt zur Build-Zeit aus
`SITE_URL`, sonst aus Vercels `VERCEL_PROJECT_PRODUCTION_URL` (das Vercel
selbst setzt, auch in Previews, und zwar auf die Produktionsdomain — genau
richtig, damit ein Preview-canonical auf Production zeigt).

Ist keine Domain bekannt, entfallen canonical, `og:url` und die Sitemap. Das
ist Absicht: eine geratene Domain wäre schlimmer als keine — ein falsches
canonical weist Suchmaschinen auf eine fremde Seite. Ein Production-Build auf
Vercel ohne Domain warnt beim Build.

Preview-Deploys bekommen eine robots.txt, die ALLES sperrt, und keine Sitemap;
sonst konkurriert jeder Feature-Branch mit der Produktionsdomain um dieselben
Inhalte. Nur Startseite, `/datenschutz` und `/nutzungsbedingungen` sind
überhaupt für Crawler freigegeben — alles andere braucht ein Kickbase-Konto und
liefert ohne Session eine Weiterleitung auf den Login.

`VITE_SUPPORT_URL` gehört in die Vercel-Projekt-Env-Vars — und zwar pro
Environment, Production und Preview getrennt. Ohne den Wert erscheint die
Unterstützen-Karte im Mehr-Tab gar nicht (`src/support/supportUrl.ts`), eine
Preview ohne die Variable zeigt sie also auch dann nicht, wenn Production sie
hat. Vercel baut nach einer Env-Änderung nicht von selbst neu — Redeploy
anstoßen.

Die Variable hieß bis zum Umzug auf Vite `EXPO_PUBLIC_SUPPORT_URL`. Wie
damals gilt: der Wert wird zur Build-Zeit eingebacken und ist damit
öffentlich.

CI (`.github/workflows/pr.yml`) fährt bei jedem PR Typecheck, Tests und den
Web-Build. `vercel-qr.yml` kommentiert den QR-Code zur Preview-URL, sobald
Vercels `deployment_status` eintrifft.

## Updates im Browser

Der reguläre Service-Worker-Update-Lifecycle taugt hier nicht: `public/sw.js`
ändert sich zwischen Deploys nicht, also feuert `waiting`/`controllerchange`
praktisch nie. Stattdessen läuft es über eine Build-ID:

1. `scripts/write-build-id.ts` schreibt vor jedem Build
   `public/build-id.txt` — Format `YYYYMMDDTHHMMSSZ-<sha7>`.
2. `public/register-sw.js` merkt sich die ID beim ersten erfolgreichen Abruf
   und holt sie danach neu: bei jedem Wechsel des Tabs in den Vordergrund
   (`visibilitychange`) und zusätzlich alle 30 Minuten. Der Abruf läuft mit
   `cache: 'no-store'` und prüft das Format — sonst würde der SPA-Rewrite eine
   HTML-Seite als Build-ID durchgehen lassen.
3. Weicht die ID ab, feuert `kickflow:update-available` auf `window`.
4. `src/components/UpdateBanner.tsx` lauscht darauf und zeigt den Banner.
   Reload passiert **nur auf Tap** — ein Auto-Reload könnte mitten in einer
   ungespeicherten Aufstellungsbearbeitung zuschlagen.

Caching in `public/sw.js`: `/assets/*` cache-first (die Dateinamen tragen einen
Hash, der Inhalt unter einer URL ändert sich nie), alles andere
network-first mit Cache als Offline-Fallback. Der Pfad hieß vor dem Umzug
`/_expo/*`; deshalb steht der Cache-Name auf `kickflow-v2` — `activate` löscht
jeden Cache mit anderem Namen und räumt die alten Einträge damit weg.

Zum Testen reicht `npm run build:web` plus ein statischer Server auf `dist/`;
im Dev-Server ist `build-id.txt` nicht Teil des Bildes.

## Verifikation im Browser

Typecheck und Vitest deckt die Logik ab, aber nicht das, was am gebauten
Artefakt schiefgeht: die Content-Security-Policy, der Service Worker, der
SPA-Rewrite, die Deep-Link-Einstiege — und die berechneten Stile, die erst in
der echten Layout-Engine entstehen. Dafür gibt es drei Skripte in
`scripts/verify/`:

```bash
npm run build:web
node scripts/verify/serve-dist.mjs . 4173 &     # dist/ mit den Headern aus vercel.json
node scripts/verify/deep-links.mjs http://localhost:4173
node scripts/verify/computed-styles.mjs http://localhost:4173
```

`serve-dist.mjs` liest Header, `cleanUrls` und den Rewrite AUS `vercel.json`,
damit die lokale Prüfung nicht von Produktion abdriften kann. Der häufigste
Fehler bei so einer Verifikation ist `serve -s dist`: das sendet keine CSP —
und genau die CSP ist der Ort, an dem ein Bundler überrascht.

`deep-links.mjs` ruft alle 13 URLs direkt auf und prüft Status, Überschrift,
Konsolenfehler und CSP-Verstöße. Letztere über das DOM-Event
`securitypolicyviolation`, nicht über eine Konsolen-Textsuche: nur so werden
auch stille Verstöße sichtbar. Genau daran ist aufgefallen, dass Zods
JIT-Kompilierung `eval` probiert (siehe `src/app/zodConfig.ts`) — die Konsole
zeigte davon nur einen abgefangenen Fehler.

Dazu sechs Sonderfälle: Deep Link ohne Session (muss auf `/login`), nackte
Liga-URL (muss auf den ersten Tab), unbekannte Unterseite (404-Route),
Zurück-Label per Deep Link (Fallback „Aufstellung"), Tab-Leiste mit
Aktivmarkierung, und dass der Service Worker `/assets/` aus `kickflow-v2`
bedient.

`computed-styles.mjs` vergleicht `getComputedStyle` gegen die Absicht — die
Schriftgröße, das Gewicht, den Hintergrund und das Padding einiger tragender
Elemente, plus die Zusicherung, dass auf keiner der 12 Seiten ein Element eine
Schrift außerhalb des Basis-Stacks berechnet. Das ist der einzige Test, der die
Kaskade misst statt sie zu lesen: welche Regel bei gleicher Spezifität gewinnt,
entscheidet die Emissionsreihenfolge im Bundle, und daran sind schon zwei
Fehler aufgefallen, die kein Unit-Test sehen konnte — die fehlende
Schriftfamilie (react-native-web hatte sie gestellt) und `layout.pressable`,
das jeden Button der App überschrieb. Beides sah im Diff korrekt aus.

Playwright ist bewusst KEINE Dependency des Projekts — das Skript erwartet eine
globale Installation und läuft nicht in CI. Es ist ein Werkzeug für den Moment
vor einem Deploy, nicht für jeden Commit.

## PWA

`public/manifest.webmanifest` deklariert `display: standalone`, `lang: de`,
Portrait und die Icons (192, 512, 512 maskable).

Auf den Weg dorthin weist `src/pwa/` genau EINMAL hin: nach dem ersten Login
erscheint ein Dialog, danach nie wieder (Merker `kickflow.installHint.v1`).
Vor dem Login nicht — wer die App noch nicht gesehen hat, kann die Frage nicht
beantworten; in der installierten PWA ebenfalls nicht (`display-mode:
standalone` bzw. `navigator.standalone`).

Was er zeigt, hängt an der Plattform, weil „installieren" dort etwas
Verschiedenes ist. Chromium meldet die Installierbarkeit über
`beforeinstallprompt` an — das Event wird beim Laden abgefangen
(`installPromptStore.ts`, deshalb auch keine Chromium-Mini-Infobar) und
später auf Knopfdruck ausgelöst. WebKit auf iOS kennt das Event nicht; dort
führt der einzige Weg über „Teilen" → „Zum Home-Bildschirm", und der Dialog
zeigt statt eines Buttons die drei Schritte. Android ohne abgefangenes Event
(Firefox u. a.) bekommt dieselbe Anleitung fürs Browser-Menü. Alles andere —
Desktop-Safari, Desktop-Firefox — bekommt nichts: ein Hinweis ohne Weg
dahinter ist schlechter als keiner.

Die Entscheidung selbst steht ohne DOM-Zugriff in `src/pwa/installHint.ts`
und ist dort ohne Browser geprüft.

Den Icon-Satz erzeugt `scripts/generate-icons.py` aus einer gemeinsamen
Vektor-Marke:

```bash
pip install pillow cairosvg && python3 scripts/generate-icons.py
```

Benachrichtigungen gibt es nicht. Aufstellungs-Deadline und ablaufende Gebote
liefen früher über `expo-notifications` und damit nur nativ; Web Push bräuchte
einen eigenen Server.
