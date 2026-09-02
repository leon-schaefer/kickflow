# kickflow

Kickbase-Companion als Expo-App. Diese README beschreibt den iOS-Release- und
OTA-Workflow.

## Entwicklung

```bash
npm start            # Metro / Expo Dev Server
npm run ios          # nativer Debug-Build auf Simulator oder Gerät
npm run web          # Web-Variante im Browser
npm test             # Vitest
npm run typecheck    # tsc --noEmit
```

OTA-Updates lassen sich hier **nicht** testen: `expo-updates` wirft unter
`__DEV__` bei `checkForUpdateAsync()` und `reloadAsync()` hart
`ERR_UPDATES_DISABLED`. Dafür braucht es einen Release-Build, siehe unten.

## Release- und OTA-Workflow (iOS)

Einmalig: `eas login` (`eas whoami` zeigt, ob du eingeloggt bist).

### Die Lanes

| Kanal | Build-Profil | Verteilung | Zielgruppe |
| --- | --- | --- | --- |
| `preview` | `preview` | internal (Ad-hoc) | eigene Geräte, ohne App Store Connect |
| `testflight` | `testflight` | store | TestFlight-Tester |
| `production` | `production` | store | App Store |

Der Kanal wird beim Build in die `Expo.plist` eingebacken — `eas build` hat
kein `--channel`-Flag. Ein Build hängt also für immer an dem Kanal seines
Profils, und ein Wechsel der Zielgruppe bedeutet immer einen neuen Build.

### 1. TestFlight-Build bauen

```bash
npm run release:ios:testflight
```

Baut mit Profil `testflight` (store-Distribution, Environment `production`,
Kanal `testflight`) und reicht direkt an App Store Connect weiter. Die
Build-Nummer zieht EAS hoch (`appVersionSource: "remote"`), `version` in
`app.json` bleibt deine Sache.

Optional die Tester-Notiz gleich mitgeben:

```bash
eas build --platform ios --profile testflight --auto-submit \
  --what-to-test "Kader- und Wert-Tab zusammengelegt"
```

Danach in TestFlight installieren und die App einmal starten — erst damit
kennt das Gerät seinen Kanal.

### 2. OTA-Update auf TestFlight schicken

JS-/Asset-Änderung committen, dann:

```bash
npm run update:testflight
```

Beim allerersten Mal legt EAS dabei den Kanal `testflight` und einen
gleichnamigen Branch an und verknüpft beide.

Auf dem Gerät: App in den Hintergrund und zurück. `src/components/UpdateBanner.tsx`
prüft bei jedem Wechsel in den Vordergrund, lädt im Hintergrund und zeigt
danach den Banner; Reload passiert erst auf Tap. Wegen
`fallbackToCacheTimeout: 0` erscheint der Banner **nicht** sofort beim ersten
Vordergrund-Wechsel nach dem Publish, sondern erst wenn der Download fertig
ist — ein paar Sekunden warten oder nochmal backgrounden.

Kommt gar nichts an, ist es fast immer der Fingerprint (siehe unten).

### 3. Auf Production wechseln

Zwei Schritte, die unabhängig voneinander sind.

**Das getestete Update nach production schieben** — republished exakt dasselbe
Update-Group, ohne neuen Bundle-Build:

```bash
npm run update:promote:testflight
```

Das erreicht alle bereits installierten Production-Builds mit passender
runtimeVersion. Weil `testflight` und `production` dieselbe runtimeVersion
haben (eas.json wird als ganze Datei gehasht, nicht pro Profil), passt ein auf
TestFlight verifiziertes Update hier unverändert.

**Einen Store-Build ausliefern** — wenn native Änderungen dabei sind oder eine
neue Version in den App Store soll:

```bash
npm run release:ios          # Build mit Profil production + Auto-Submit
npm run submit:ios           # nur einreichen, letzter Build
```

Den `testflight`-Build dafür **nicht** wiederverwenden: beide Profile landen
im selben App-Store-Connect-Record, und ein zur Review eingereichter
testflight-Build würde alle App-Store-Nutzer an den Tester-Kanal hängen.

### 4. OTA-Update auf Production

```bash
npm run update:production
```

Geht direkt an alle App-Store-Nutzer mit passender runtimeVersion — ohne den
Umweg über TestFlight also mit voller Reichweite. Für alles außer trivialen
Fixes lieber Schritt 2 und dann Schritt 3.

### Fingerprint: wann ein OTA-Update nicht reicht

`runtimeVersion` steht in `app.json` auf `policy: "fingerprint"`. Ein Update
wird nur ausgeliefert, wenn sein Fingerprint exakt dem des installierten
Builds entspricht. Vor dem Publish prüfen:

```bash
eas build:list --platform ios --build-profile testflight --limit 5
eas fingerprint:compare --build-id <BUILD-ID> --environment production
```

`--environment` muss zum Profil passen, sonst vergleichst du gegen andere
Env-Variablen. Ohne Build-ID zur Hand:

```bash
npx expo-updates runtimeversion:resolve --platform ios
npx expo-updates fingerprint:generate --platform ios   # inkl. Quellenliste
```

Den Fingerprint ändern unter anderem: `app.json`, `package.json` (inklusive
`scripts`), `.gitignore`, native Dependencies — **und `eas.json`**, das
`@expo/fingerprint` als ganze Datei mithasht und für das es keinen
`sourceSkip` gibt. Nach einer Änderung an einer dieser Dateien erreichen
OTA-Updates die bereits installierten Builds nicht mehr; es braucht einen
neuen Build.

Bewusst *nicht* im Fingerprint: `version` aus `app.json` — dafür sorgt
`fingerprint.config.js`, sonst würde jeder Versions-Bump alle laufenden
Installationen von OTA abschneiden.

### Notfall: Update zurückziehen

```bash
eas update:roll-back-to-embedded --channel production
```

Setzt die Clients auf das im Binary eingebackene Bundle zurück. Alternativ ein
älteres Update-Group per `eas update:republish` wieder nach vorn holen.

### Nachschlagen

```bash
eas channel:view testflight              # welcher Branch hängt am Kanal
eas update:list --branch testflight      # zuletzt publizierte Updates
eas build:list --platform ios --limit 5  # Builds inkl. IDs und Status
```
