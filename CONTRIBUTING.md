# Mitmachen

kickflow ist ein Ein-Personen-Hobbyprojekt, das öffentlich liegt, damit man
nachlesen kann, was mit dem eingetippten Kickbase-Passwort passiert. Beiträge
sind willkommen, aber das Projekt ist nicht darauf angewiesen — daraus folgt
eine Bitte und eine Warnung.

**Die Bitte: erst ein Issue, dann Code.** Ein Pull Request, der eine Funktion
mitbringt, über die vorher nicht geredet wurde, kann abgelehnt werden, obwohl
er gut ist — weil er in eine Richtung zeigt, in die die App nicht gehen soll.
Das ist für beide Seiten die teure Variante. Ein Issue vorab kostet dich zwei
Sätze.

**Die Warnung: die Antwort kann dauern.** Kein Bereitschaftsdienst, keine
Service-Zeiten. Sicherheitslücken sind die Ausnahme, für die es einen eigenen
Weg gibt — siehe [SECURITY.md](SECURITY.md), bitte **nicht** als öffentliches
Issue.

Klein und lokal (ein Bugfix, ein Tippfehler, ein fehlender Test, eine
Barrierefreiheits-Korrektur) darf ohne Vorrede kommen.

## Einmalig einrichten

```bash
npm ci        # nicht npm install: derselbe Baum wie in CI und bei Vercel
npm run dev   # Vite Dev-Server
```

Mehr braucht es nicht. Es gibt keinen Server, keine Datenbank und keine
Secrets: die App spricht aus dem Browser direkt mit der Kickbase-API, und
einloggen kannst du dich mit deinem eigenen Kickbase-Konto. Nur
`npm run probe` (der API-Explorer) braucht eine `.env.local` — Vorlage in
`.env.local.example`. Vorsicht dort mit den Schreib-Flags, sie wirken in der
echten Liga.

## Vor jedem Pull Request

```bash
npm test           # Vitest, muss vollständig grün sein
npm run typecheck  # tsc --noEmit
npm run build:web  # der Build, den auch Vercel fährt
```

Dieselben drei Schritte fährt `.github/workflows/pr.yml` bei jedem Pull
Request. Sie brauchen keine Secrets und laufen deshalb auch in einem Fork. Der
zweite Workflow (`vercel-qr.yml`) überspringt Forks absichtlich: er würde einen
Kommentar schreiben wollen und hat im Fork keine Schreibrechte — ein
übersprungener Lauf ist kein Fehler an deinem Beitrag.

Wenn der Beitrag am Layout, an der CSP oder am Service Worker rührt, ist der
Abschnitt „Verifikation im Browser" in der [README](README.md) der Teil, der
sich lohnt: Unit-Tests sehen die berechnete Kaskade nicht, und dort sind schon
zwei Fehler aufgefallen, die im Diff korrekt aussahen. Playwright ist bewusst
keine Dependency, das Skript erwartet eine globale Installation.

## Konventionen

**[AGENTS.md](AGENTS.md) ist verbindlich, nicht dekorativ.** Dort steht, was
sich nicht ändern darf, ohne dass etwas still kaputtgeht — die
`composes: v/h`-Regel in `src/theme/layout.module.css`, die Spezifität-0-Basis
in `:where()`, `src/theme/tokens.css` als generierte Datei, der
`@/app/zodConfig`-Import in jedem Modul, das `zod` benutzt, die fehlende
Safe-Area-Randlosigkeit, die Kopplung der Datenschutz-Tabelle an
`src/storage/keys.ts`. Jeder dieser Punkte hat einen Test hinter sich und eine
Begründung in der Datei selbst. Wenn du von einem abweichen willst: die
Begründung dort lesen und im Issue widerlegen — sie kann falsch sein, aber sie
ist nicht willkürlich.

Zwei Dinge, die dabei am häufigsten überraschen:

- Was an React Native oder Expo erinnert (`StyleSheet.create`, `<View>`, ein
  `expo-`Import), ist ein übersehener Rest und gehört portiert, nicht ergänzt.
  In Kommentaren steht die alte Fassung dagegen absichtlich — sie erklärt, was
  eine Zeile heute leistet.
- `src/theme/tokens.css` wird nicht von Hand editiert, sondern mit
  `npm run tokens` aus `src/theme/tokens.ts` erzeugt. Neue oder geänderte
  Textfarben müssen zusätzlich durch `src/theme/contrast.test.ts` (4.5:1 gegen
  alle drei Flächen).

**Sprache: Deutsch**, in Kommentaren, Commits und Doku. Die Oberfläche ist
deutsch, die Nutzer sind es, die Rechtsseiten sind es — eine englische
Codebasis darüber wäre eine Naht ohne Nutzen.

**Kommentare erklären das Warum.** Was der Code tut, steht im Code. In diesem
Repo steht in den Kommentaren, welche Alternative verworfen wurde und woran
sie gescheitert ist — daran hängt der Wert. Ein Kommentar, der die Zeile unter
sich nachspricht, wird im Review gestrichen.

**Commits:** Die Betreffzeile sagt, was der Nutzer danach kann oder sieht, in
einer Zeile, ohne Präfix wie `feat:` — „Filter und Sortierung der
Spielerlisten die Navigation überleben lassen". Der Rumpf, wo einer nötig ist,
folgt der Reihenfolge Symptom, Ursache (belegt, nicht vermutet), Lösung und
warum nicht anders. `git log` liest sich hier wie ein Änderungsprotokoll für
Menschen; das ist Absicht.

## Pull Requests

Ziel-Branch ist der **Default-Branch** des Repos, solange das Issue nichts
anderes sagt — er ist das, was Vercel nach Production deployt, und der Stand,
gegen den zuletzt gemerged wurde. Für einen Beitrag genügt: verzweige von dem
Branch, den GitHub dir als Default anbietet, und stelle den Pull Request auch
dorthin. Warum die Namen hier festgenagelt sind, steht im Kopf von
`scripts/protect-branches.sh`.

Ein Pull Request beschreibt, was ein Nutzer danach anders erlebt, und was du
geprüft hast. Vercel baut zu jedem Pull Request eine Preview, deren QR-Code als
Kommentar erscheint — bei Beiträgen aus einem Fork nur, wenn ich das Deployment
freigebe.

## Lizenz deines Beitrags

Das Projekt steht unter der [Apache-2.0-Lizenz](LICENSE). Wer einen Pull
Request stellt, stellt seinen Beitrag unter dieselbe Lizenz (Apache-2.0 §5).
Ein CLA gibt es nicht und ist nicht geplant.

Was die Lizenz **nicht** mitgibt, ist der Name: „kickflow", das Icon und das
Vorschaubild bleiben beim Projekt (Apache-2.0 §6). Ein Fork darf alles außer
sich weiter kickflow nennen — und das ist kein juristischer Reflex, sondern
folgt aus dem, was die App tut: sie nimmt fremde Kickbase-Zugangsdaten an. Wenn
zwei Seiten mit demselben Namen und demselben Icon danach fragen, kann ein
Nutzer nicht mehr entscheiden, welcher er sie geben darf.
