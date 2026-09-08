# kickflow

Der Aufstellungs-Optimizer für die Kickbase-Liga: die beste Elf für den
nächsten Spieltag — mit dem Restprogramm, mit den Verkäufen, die ein Konto im
Minus ausgleichen, und mit den Regeln, die in der eigenen Liga vereinbart
sind. Dazu Markt, Marktwerte, Kader der Mitspieler und die Tabelle. React-SPA
(Vite + React Router), ausgeliefert **ausschließlich als Web-App/PWA** über
Vercel. Projektseite: <https://codewithleon.dev/apps/kickflow/>.

> **Inoffiziell.** kickflow ist ein privates Projekt und wird weder von der
> Kickbase GmbH betrieben noch von ihr geprüft oder genehmigt; es besteht
> keine geschäftliche Verbindung. „Kickbase" ist eine Marke der Kickbase GmbH
> und steht hier ausschließlich beschreibend. Die App spricht eine nicht
> öffentlich dokumentierte Schnittstelle an, die sich ohne Ankündigung ändern
> darf — auch so, dass kickflow von einem Tag auf den anderen nicht mehr
> funktioniert. Bedingungen und Datenschutzerklärung liegen als Seiten in der
> App (`/nutzungsbedingungen`, `/datenschutz`, öffentlich und ohne Login).

## Warum der Quelltext offen liegt

Wer kickflow benutzt, tippt sein **Kickbase-Passwort** in ein Formular, das
nicht von Kickbase kommt. Die Startseite behauptet dazu drei Dinge: die App
spricht direkt aus dem Browser mit der Kickbase-API, ohne einen Server von
kickflow dazwischen; Zugangsdaten und Token verlassen das Gerät nur in
Richtung Kickbase; kein Tracking, keine Analyse, und nachgeladen wird von
keiner anderen Stelle etwas.

Diese drei Sätze sind der Grund für das offene Repo: hier sind sie
nachprüfbar statt geglaubt. `src/api/kickbase/client.ts` ist ein `fetch`
gegen genau eine Basis-URL, `src/auth/` zeigt, was mit Passwort und Token
passiert, und die Content-Security-Policy in `vercel.json` würde jedes andere
Ziel im Browser blockieren — `default-src 'self'`, `connect-src` mit
Kickbase-API und Bilder-CDN, sonst nichts. Ein Versprechen, das man
nachrechnen kann, ist mehr wert als eines, das man betont.

## Selbst ausprobieren

```bash
npm ci        # nicht npm install: derselbe Baum wie in CI und bei Vercel
npm run dev   # Vite Dev-Server
```

Mehr ist nicht nötig: kein Server, keine Datenbank, keine Secrets, kein
API-Schlüssel. Angemeldet wird sich mit einem **eigenen** Kickbase-Konto, und
alles, was die App danach tut, tut sie gegen die echte Liga — es gibt keinen
Testmodus. Die vollständige Befehlsliste steht unter
[Entwicklung](#entwicklung).

## Lizenz

[Apache-2.0](LICENSE). Ein Fork darf die App also nehmen, ändern und selbst
betreiben — nur nicht unter diesem Namen: „kickflow", das Icon und das
Vorschaubild gibt die Lizenz nicht mit (Apache-2.0 §6). Das ist kein
juristischer Reflex, sondern folgt aus dem, was die App tut. Sie nimmt fremde
Kickbase-Zugangsdaten an; wenn zwei Seiten mit demselben Namen und demselben
Icon danach fragen, kann ein Nutzer nicht mehr entscheiden, welcher er sie
geben darf.

## Mitmachen, Fehler, Sicherheitslücken

Fehler und Wünsche gehören in ein
[Issue](https://github.com/leon-schaefer/kickflow/issues), Beiträge in einen
Pull Request gegen den Default-Branch — was vorher zu lesen ist, steht in
[CONTRIBUTING.md](CONTRIBUTING.md), die verbindlichen Konventionen in
[AGENTS.md](AGENTS.md).

**Sicherheitslücken nicht als Issue.** Die App verarbeitet fremde
Zugangsdaten; der Meldeweg dafür steht in [SECURITY.md](SECURITY.md).

## Warum keine Store-App

kickflow zeigt Inhalte von Kickbase an (Marktwerte, Kader, Vereinslogos) und
meldet sich mit dem Kickbase-Konto des Nutzers an. Apple verlangt bei der
Einreichung die Rechte an genau diesen Inhalten, und eine Genehmigung von
Kickbase gibt es nicht. Die native Auslieferung — EAS, TestFlight,
OTA-Updates, Fingerprint — ist deshalb komplett entfernt.

---

Alles ab hier beschreibt Entwicklung und Betrieb. Der Abschnitt
[Deployment](#deployment) ist Betreiber-Wissen: er setzt Zugriff auf das
GitHub-Repo und das Vercel-Projekt voraus und gilt nicht für einen Fork.

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
und `public/sitemap.xml`, dann baut `vite build` nach `dist/`. Alle drei sind
gitignored: sie enthalten die Domain bzw. die Build-ID und nicht Quelltext. Alles unter
`public/` (Manifest, Service Worker, Icons, Favicon, Build-ID) kopiert Vite
unverändert mit, `index.html` im Projekt-Root ist der Einstieg.

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

`VITE_SUPPORT_URL` gehört in die Vercel-Projekt-Env-Vars — und zwar pro
Environment, Production und Preview getrennt. Ohne den Wert erscheint die
Unterstützen-Karte im Mehr-Tab gar nicht (`src/support/supportUrl.ts`), eine
Preview ohne die Variable zeigt sie also auch dann nicht, wenn Production sie
hat. Vercel baut nach einer Env-Änderung nicht von selbst neu — Redeploy
anstoßen.

Die Variable hieß bis zum Umzug auf Vite `EXPO_PUBLIC_SUPPORT_URL`. Wie
damals gilt: der Wert wird zur Build-Zeit eingebacken und ist damit
öffentlich.

`VITE_SITE_URL` ist die zweite Build-Variable und betrifft die Vorschaukarte
(siehe „Geteilte Links" unten). Sie ist optional: ohne sie nimmt der Build
`VERCEL_PROJECT_PRODUCTION_URL`, das Vercel selbst in jeden Build legt.
Gebraucht wird sie erst, wenn die App unter einer Domain läuft, die Vercel
nicht als Produktions-Domain des Projekts kennt. Fehlen im Vercel-Build beide,
schlägt der Build fehl — mit Absicht (`scripts/siteOrigin.ts`).

Das Feedback-Formular im Mehr-Tab (`/feedback`) braucht dagegen **keine**
Env-Var: der Empfänger steht als `FEEDBACK_EMAIL` in `src/support/links.ts`,
neben Homepage- und Datenschutz-Link und aus demselben Grund — ein
Feedback-Weg, der je nach Environment fehlt, ist keiner. Wer die Adresse
ändert, muss dafür sorgen, dass das Postfach existiert: die App verschickt
nicht selbst, sie öffnet das Mail-Programm des Nutzers mit fertigem Betreff
und Text (`src/support/feedback.ts`), und ob eine Mail ankommt, kann sie nicht
erkennen.

Mailto und kein Formular-Dienst, weil kickflow keinen eigenen Server hat: ein
Endpunkt bei Formspree & Co. bräuchte einen dritten Host in `connect-src`.
Der Preis ist ein Nutzer ohne eingerichtetes Mail-Programm — für den steht
Betreff und Text auf dem Screen zum Kopieren daneben.

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

`deep-links.mjs` ruft alle 14 URLs direkt auf und prüft Status, Überschrift,
Konsolenfehler und CSP-Verstöße. Letztere über das DOM-Event
`securitypolicyviolation`, nicht über eine Konsolen-Textsuche: nur so werden
auch stille Verstöße sichtbar. Genau daran ist aufgefallen, dass Zods
JIT-Kompilierung `eval` probiert (siehe `src/app/zodConfig.ts`) — die Konsole
zeigte davon nur einen abgefangenen Fehler.

Dazu sieben Sonderfälle: Deep Link ohne Session (muss auf `/login`), `/` MIT
Session (muss auf die Ligenliste, die Startseite ist für Fremde), nackte
Liga-URL (muss auf den ersten Tab), unbekannte Unterseite (404-Route),
Zurück-Label per Deep Link (Fallback „Aufstellung"), Tab-Leiste mit
Aktivmarkierung, und dass der Service Worker `/assets/` aus `kickflow-v2`
bedient.

`computed-styles.mjs` vergleicht `getComputedStyle` gegen die Absicht — die
Schriftgröße, das Gewicht, den Hintergrund und das Padding einiger tragender
Elemente, plus die Zusicherung, dass auf keiner der 14 Seiten ein Element eine
Schrift außerhalb des Basis-Stacks berechnet. Das ist der einzige Test, der die
Kaskade misst statt sie zu lesen: welche Regel bei gleicher Spezifität gewinnt,
entscheidet die Emissionsreihenfolge im Bundle, und daran sind schon zwei
Fehler aufgefallen, die kein Unit-Test sehen konnte — die fehlende
Schriftfamilie (react-native-web hatte sie gestellt) und `layout.pressable`,
das jeden Button der App überschrieb. Beides sah im Diff korrekt aus.

Playwright ist bewusst KEINE Dependency des Projekts — das Skript erwartet eine
globale Installation und läuft nicht in CI. Es ist ein Werkzeug für den Moment
vor einem Deploy, nicht für jeden Commit.

## Geteilte Links und die öffentliche Startseite

kickflow wird nicht gefunden, sondern weitergereicht: der Weg zu neuen Nutzern
führt über einen Link im Gruppenchat einer Liga. Daran hängen drei Dinge, die
alle im Browser unsichtbar brechen.

**Die Startseite.** `/` zeigt ohne Session eine öffentliche Seite
(`src/screens/LandingScreen.tsx`) statt sofort den Login. Vorher stand ein
Fremder als Erstes vor einem Feld für sein KICKBASE-Passwort — die Frage, die
er an dieser Stelle nicht beantworten kann. Die Verzweigung liegt in
`src/routes/IndexRoute.tsx`: mit Session auf die Ligenliste, ohne Session in
der installierten PWA auf den Login (dort ist `/` die `start_url`, und wer die
App auf dem Startbildschirm hat, ist geworben), sonst die Startseite. Was dort
steht, muss der App entsprechen — jeder Punkt nennt eine Funktion, die es
gibt.

**Die Vorschaukarte.** Die Open-Graph-Tags in der `index.html` füllen die
Karte, die WhatsApp, Discord, Signal und Reddit zu einem Link zeigen. Ihre
URLs müssen ABSOLUT sein; die Herkunft dafür setzt ein Plugin in
`vite.config.ts` zur Build-Zeit für `%SITE_ORIGIN%` ein (Herleitung und
Reihenfolge der Quellen in `scripts/siteOrigin.ts`, Env-Variable siehe oben).
Das Bild ist `public/og-image.png`, 1200x630. `src/updates/indexHtml.test.ts`
hält Tags, Absolutheit und die Maße des Bildes fest — geprüft am PNG selbst,
nicht an einer Notiz.

**Der Weg hinaus.** Der Mehr-Tab hat eine Karte „Liga-Kollegen einladen"
(`src/support/shareInvite.ts`): `navigator.share`, sonst die Zwischenablage,
sonst der Link im Klartext. Der letzte Fall ist kein Beiwerk — in der
installierten PWA gibt es keine Adressleiste, aus der jemand die URL ablesen
könnte.

`public/robots.txt` erlaubt alles. Die Datei muss trotzdem existieren: der
Catch-All-Rewrite liefert für einen fehlenden Pfad die `index.html` mit Status
200, ein Crawler bekäme unter `/robots.txt` sonst HTML.

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

Den Icon-Satz und das Share-Bild erzeugt `scripts/generate-icons.py` aus einer
gemeinsamen Vektor-Marke:

```bash
pip install pillow cairosvg && python3 scripts/generate-icons.py
```

Die Ausgabe ist deterministisch und liegt im Repo; laufen muss das Skript nur,
wenn sich die Marke ändert — oder der Text im Share-Bild, dem einzigen Asset
mit Schrift. Wer es neu erzeugt, sollte `public/og-image.png` danach ansehen:
gerendert wird mit der Schrift, die auf der eigenen Maschine liegt.

Benachrichtigungen gibt es nicht. Aufstellungs-Deadline und ablaufende Gebote
liefen früher über `expo-notifications` und damit nur nativ; Web Push bräuchte
einen eigenen Server.
