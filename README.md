# kickflow

Kickbase-Companion als Expo-App, ausgeliefert **ausschließlich als Web-App/PWA**
über Vercel. Diese README beschreibt Entwicklung und Deployment.

Warum keine Store-App: kickflow zeigt Inhalte von Kickbase an (Marktwerte,
Kader, Vereinslogos) und meldet sich mit dem Kickbase-Konto des Nutzers an.
Apple verlangt bei der Einreichung die Rechte an genau diesen Inhalten, und
eine Genehmigung von Kickbase gibt es nicht. Die native Auslieferung — EAS,
TestFlight, OTA-Updates, Fingerprint — ist deshalb komplett entfernt.

## Entwicklung

```bash
npm start            # Metro / Expo Dev Server (Web über `w`)
npm run web          # direkt im Browser
npm test             # Vitest
npm run typecheck    # tsc --noEmit
npm run probe        # Kickbase-API-Explorer, braucht .env.local
```

`npm run probe` spricht mit einem echten Konto und dumpt Rohantworten nach
`scripts/.probe-output/` (git-ignoriert). Zugangsdaten dafür in `.env.local`,
Vorlage in `.env.local.example`.

## Deployment

Vercel deployt über die Git-Integration, die Konfiguration steht komplett in
`vercel.json`:

| Schlüssel | Wert |
| --- | --- |
| `buildCommand` | `npm run build:web` |
| `outputDirectory` | `dist` |
| `rewrites` | `/:path*` → `/` |

`npm run build:web` macht zwei Dinge: `scripts/write-build-id.ts` schreibt
`public/build-id.txt`, dann exportiert `expo export -p web` nach `dist/`.
Alles unter `public/` (Manifest, Service Worker, Icons, Build-ID) kopiert Expo
unverändert mit, `public/index.html` dient als HTML-Template.

Der Catch-All-Rewrite ist zwingend: `app.json` setzt `web.output: "single"`,
es gibt also nur eine `index.html` und keine Datei pro Route. Nebenwirkung, auf
die der Update-Check unten Rücksicht nimmt: eine fehlende Datei liefert nicht
404, sondern `index.html` mit Status 200.

`vercel.json` setzt außerdem CSP und Security-Header. Die CSP erlaubt
ausdrücklich `api.kickbase.com` (die App spricht die Kickbase-API direkt aus
dem Browser, ohne Proxy) und `kickbase.b-cdn.net` für Logos und Spielerbilder.
`script-src 'self'` ohne `unsafe-inline`/`unsafe-eval` — das ist der Grund,
warum der Token im localStorage vertretbar ist (`src/auth/tokenStore.ts`).

`EXPO_PUBLIC_SUPPORT_URL` gehört in die Vercel-Projekt-Env-Vars — und zwar pro
Environment, Production und Preview getrennt. Ohne den Wert erscheint die
Unterstützen-Karte im Mehr-Tab gar nicht (`src/support/supportUrl.ts`), eine
Preview ohne die Variable zeigt sie also auch dann nicht, wenn Production sie
hat.

Lokal ist dabei eine Falle zu beachten: Metro backt `EXPO_PUBLIC_*` beim
Bundling textuell ein, sein Transform-Cache schlüsselt aber nicht auf den
Wert. Nach dem Setzen oder Ändern der Variable liefert ein Build aus dem Cache
weiter den alten Stand — dann `rm -rf node_modules/.cache` und neu bauen.
Vercel baut immer kalt und ist davon nicht betroffen.

CI (`.github/workflows/pr.yml`) fährt bei jedem PR Typecheck, Tests und den
Web-Build. `vercel-qr.yml` kommentiert den QR-Code zur Preview-URL, sobald
Vercels `deployment_status` eintrifft.

## Updates im Browser

Der reguläre Service-Worker-Update-Lifecycle taugt hier nicht: `public/sw.js`
ändert sich zwischen Deploys nicht, also feuert `waiting`/`controllerchange`
praktisch nie. Stattdessen läuft es über eine Build-ID:

1. `scripts/write-build-id.ts` schreibt vor jedem Export
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

Caching in `public/sw.js`: `/_expo/*` cache-first (die Dateinamen tragen einen
Hash, der Inhalt unter einer URL ändert sich nie), alles andere
network-first mit Cache als Offline-Fallback.

Zum Testen reicht `npm run build:web` plus ein statischer Server auf `dist/`;
im Dev-Server ist `build-id.txt` nicht Teil des Bildes.

## PWA

`public/manifest.webmanifest` deklariert `display: standalone`, `lang: de`,
Portrait und die Icons (192, 512, 512 maskable). Installiert wird über die
Browser-eigene UI („Zum Home-Bildschirm hinzufügen"); die App zeigt dafür
keinen eigenen Hinweis.

Den Icon-Satz erzeugt `scripts/generate-icons.py` aus einer gemeinsamen
Vektor-Marke:

```bash
pip install pillow cairosvg && python3 scripts/generate-icons.py
```

Benachrichtigungen gibt es nicht. Aufstellungs-Deadline und ablaufende Gebote
liefen früher über `expo-notifications` und damit nur nativ; Web Push bräuchte
einen eigenen Server.
