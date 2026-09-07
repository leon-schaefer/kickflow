# Sicherheitslücken melden

kickflow meldet sich mit dem **Kickbase-Konto des Nutzers** an. Damit ist jede
Lücke, die an die Zugangsdaten oder an das Sitzungstoken kommt, kein
kosmetischer Fehler, sondern der Zugriff auf das Spielkonto eines Fremden —
Aufstellung, Gebote, Transfers. Solche Funde bitte **nicht** als öffentliches
Issue.

## Meldeweg

Bevorzugt über **Private Vulnerability Reporting** auf GitHub: Reiter
„Security" → „Report a vulnerability". Der Bericht liegt dann nicht
öffentlich und die Antwort hängt am Bericht statt in einem Postfach.

Alternativ per Mail an **security@kickflow.online**.

Hilfreich im Bericht: welche Fassung (Version und Commit stehen unten im
Mehr-Tab), welcher Browser, und die Schritte, mit denen es reproduzierbar ist.
Ein Proof of Concept ist willkommen, ein Video ersetzt ihn nicht.

## Was du erwarten kannst

kickflow ist ein Hobbyprojekt einer einzelnen Person, kein Produkt mit
Bereitschaftsdienst. Es gibt kein Bug-Bounty und keine Bezahlung. Was es gibt:
eine Rückmeldung innerhalb einer Woche, eine ehrliche Einschätzung und —
wenn der Fund zutrifft — einen Fix im Repo, mit Nennung im Commit, falls
das gewünscht ist. Bitte bis zum Deploy des Fixes nichts veröffentlichen; bei
etwas, das länger dauert, verabreden wir einen Termin.

Gefixt wird immer nur die aktuelle Fassung auf `main`, also das, was unter der
Produktionsdomain steht. Es gibt keine gepflegten älteren Versionen und damit
auch keine Backports: die App lädt sich beim nächsten Start selbst neu (siehe
„Updates im Browser" in der [README](README.md)).

## Was besonders interessiert

Die App hat **keinen eigenen Server** — kein Backend, keine Datenbank, kein
Konto bei mir. Sie spricht aus dem Browser direkt mit `api.kickbase.com`. Die
Angriffsfläche ist deshalb der ausgelieferte Client und das Hosting drumherum:

- **Jede Form von Script-Injektion.** Das Sitzungstoken liegt im
  `localStorage` (`src/auth/tokenStore.ts`). Das ist eine bewusste
  Entscheidung und mit `script-src 'self'` ohne `unsafe-inline`/`unsafe-eval`
  in der `vercel.json` begründet, nicht mit Bequemlichkeit — sie steht und
  fällt aber mit genau dieser Content-Security-Policy. Ein Weg, doch eigenes
  JavaScript auf der Seite auszuführen, ist der schwerste Fund, den es hier
  geben kann.
- **Wege an der CSP vorbei**, auch die stillen: ein injiziertes
  Inline-`<script>` aus dem Build, ein `eval` in einer Abhängigkeit, ein Ziel
  in `connect-src`, das dort nicht hingehört.
- **Alles, wo Fremdtext in die Seite kommt** — Spieler- und Liganamen,
  Manager-Namen, Parameter aus geteilten Links.
- **Der Service Worker** (`public/sw.js`): `/assets/*` liegt cache-first, und
  ein Weg, dort etwas Eigenes hineinzulegen, würde dauerhaft ausgeliefert.
- **Der SPA-Rewrite**: eine fehlende Datei liefert `index.html` mit Status 200.
  Wenn daran etwas hängt, das mehr als eine falsche Seite ergibt, ist es ein
  Fund.
- **Abhängigkeiten**, wenn eine gemeldete Lücke im gebauten Bundle wirklich
  erreichbar ist (nicht der reine `npm audit`-Ausdruck).

## Was kein Fund für dieses Repo ist

- Lücken **in Kickbase selbst** oder in der Kickbase-API. Die gehören zur
  Kickbase GmbH, nicht hierher — kickflow ist ein unabhängiges Projekt ohne
  Verbindung dorthin (siehe [README](README.md)).
- Dass die App eine **nicht dokumentierte API** benutzt oder dass sie ohne
  Genehmigung von Kickbase existiert. Das ist bekannt, steht in den
  Nutzungsbedingungen der App und ist keine Sicherheitslücke.
- Dass `VITE_*`-Variablen und die Feedback-Adresse **im Bundle lesbar** sind.
  Das ist so gewollt und in `.env.local.example` erklärt; Geheimnisse stehen
  dort nicht.
- Dass die Vorschaubild-URL im QR-Kommentar eines Pull Requests an einen
  externen Renderer geht. Bewusst und dokumentiert in
  `.github/workflows/vercel-qr.yml`.
- Reine Scanner-Ausgaben ohne gezeigte Auswirkung (fehlende Header, die nichts
  schützen, was hier existiert; „Passwortfeld ohne Autocomplete-Attribut").
