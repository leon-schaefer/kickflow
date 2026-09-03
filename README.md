# kickflow

Kickbase-Companion als Expo-App. Diese README beschreibt den Release- und
OTA-Workflow für iOS und Android.

## Entwicklung

```bash
npm start            # Metro / Expo Dev Server
npm run ios          # nativer Debug-Build auf Simulator oder Gerät
npm run android      # nativer Debug-Build auf Emulator oder Gerät
npm run web          # Web-Variante im Browser
npm test             # Vitest
npm run typecheck    # tsc --noEmit
```

OTA-Updates lassen sich hier **nicht** testen: `expo-updates` wirft unter
`__DEV__` bei `checkForUpdateAsync()` und `reloadAsync()` hart
`ERR_UPDATES_DISABLED`. Dafür braucht es einen Release-Build, siehe unten.

## Release- und OTA-Workflow

Einmalig: `eas login` (`eas whoami` zeigt, ob du eingeloggt bist). Für Android
kommt eine einmalige Einrichtung dazu, siehe [Android einmalig
einrichten](#android-einmalig-einrichten).

### Die Lanes

Ein Kanal, ein Build-Profil, zwei Plattformen:

| Kanal | Build-Profil | iOS | Android |
| --- | --- | --- | --- |
| `preview` | `preview` | internal (Ad-hoc) | internal (APK per Link) |
| `testflight` | `testflight` | TestFlight | Play-Track `internal` |
| `production` | `production` | App Store | Play-Track `production` |

Der Kanal wird beim Build ins Binary eingebacken — in die `Expo.plist` bzw. das
`AndroidManifest.xml`, `eas build` hat kein `--channel`-Flag. Ein Build hängt
also für immer an dem Kanal seines Profils, und ein Wechsel der Zielgruppe
bedeutet immer einen neuen Build.

Der Name `testflight` ist historisch: der Kanal steckt in jedem bereits
ausgelieferten iOS-Binary, ein Umbenennen würde deren OTA-Kette kappen. Für
Android heißt er schlicht "interne Tester".

### Was CI von allein macht

`.github/workflows/release.yml` entscheidet bei jedem Push selbst zwischen OTA
und Build — `develop` bedient den Kanal `testflight`, `main` den Kanal
`production`. Die Entscheidung fällt **pro Plattform**, denn iOS und Android
haben je einen eigenen Fingerprint und einen eigenen Build-Stand. Ein Lauf kann
deshalb gleichzeitig ein OTA publizieren (für die Plattform, deren letztes
Binary passt) und einen Build starten (für die andere).

Die Kommandos unten sind der manuelle Weg — für den ersten Android-Build, für
Läufe zwischendurch und wenn CI nicht greift.

### Android einmalig einrichten

Vier Schritte, danach läuft Android wie iOS über `--auto-submit`.

**1. App in der Play Console anlegen.** Paketname `dev.codewithleon.kickflow`
(`android.package` in `app.json`) — nach dem ersten Upload ist er unveränderlich.

**2. Play App Signing aktivieren.** Standard bei neuen Apps. Den Upload-Keystore
generiert EAS beim ersten Build und verwahrt ihn in den Projekt-Credentials;
lokal liegt er nicht (`*.jks` ist ohnehin in `.gitignore`).

```bash
eas credentials --platform android      # Keystore ansehen oder herunterladen
```

**3. Das erste App Bundle von Hand hochladen.** Die Play Console nimmt das
allererste AAB einer App nur über die Weboberfläche an; `eas submit` scheitert
davor mit *"You need to upload the first APK/AAB manually"*. Also einmal:

```bash
npm run build:android                   # ohne --auto-submit
```

Das fertige `.aab` von der EAS-Buildseite laden und in der Play Console in den
Track `internal` hochladen. Ab dann funktioniert `--auto-submit`.

**4. Service-Account-Key bei EAS hinterlegen.** `eas submit` braucht einen
Google-Service-Account-Key, um in deinem Namen hochzuladen
([Anleitung](https://github.com/expo/fyi/blob/main/creating-google-service-account.md)).
Der Key gehört **nicht** ins Repo und nicht als `serviceAccountKeyPath` in
`eas.json` — in CI gibt es die Datei nicht. Stattdessen einmal zu den
Projekt-Credentials hochladen:

```bash
eas credentials --platform android      # > Google Service Account > Upload
```

Danach findet `eas submit --non-interactive` den Key von selbst, lokal wie in
CI.

Zum Schluss in der Play Console unter *Testen > Interner Test* die Tester
eintragen, sonst hat der `internal`-Track kein Publikum.

### 1. Tester-Build bauen

```bash
npm run release:ios:testflight          # Profil testflight -> TestFlight
npm run release:android:internal        # Profil testflight -> Play-Track internal
```

Beide bauen mit Profil `testflight` (store-Distribution, Environment
`production`, Kanal `testflight`) und reichen direkt an den jeweiligen Store
weiter. Build-Nummer und `versionCode` zieht EAS hoch
(`appVersionSource: "remote"`), `version` in `app.json` bleibt deine Sache.

Optional die Tester-Notiz gleich mitgeben (nur iOS/TestFlight):

```bash
eas build --platform ios --profile testflight --auto-submit \
  --what-to-test "Kader- und Wert-Tab zusammengelegt"
```

Danach installieren — auf iOS über TestFlight, auf Android über den
Opt-in-Link des internen Tests — und die App einmal starten. Erst damit kennt
das Gerät seinen Kanal.

### 2. OTA-Update auf den Tester-Kanal schicken

JS-/Asset-Änderung committen, dann:

```bash
npm run update:testflight
```

Das publiziert **eine** Update-Gruppe für beide Plattformen, jede mit ihrer
eigenen runtimeVersion. Beim allerersten Mal legt EAS dabei den Kanal
`testflight` und einen gleichnamigen Branch an und verknüpft beide.

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
dem Tester-Kanal verifiziertes Update hier unverändert.

**Einen Store-Build ausliefern** — wenn native Änderungen dabei sind oder eine
neue Version in die Stores soll:

```bash
npm run release:ios              # Build mit Profil production + Auto-Submit
npm run release:android          # dito für den Play-Track production
npm run submit:ios               # nur einreichen, letzter Build
npm run submit:android           # dito für Android
```

`--auto-submit` lädt nur hoch, es veröffentlicht nicht: auf iOS landet der
Build in App Store Connect ohne Review-Einreichung, auf Android als
**Draft-Release** im Track `production` (`releaseStatus` in `eas.json`).
Ausgerollt wird von Hand — in App Store Connect bzw. in der Play Console.

Den `testflight`-Build dafür **nicht** wiederverwenden: beide Profile landen im
selben App-Store-Connect- und Play-Store-Record, und ein zur Review
eingereichter bzw. nach `production` geschobener testflight-Build würde alle
Store-Nutzer an den Tester-Kanal hängen.

### 4. OTA-Update auf Production

```bash
npm run update:production
```

Geht direkt an alle Store-Nutzer mit passender runtimeVersion — ohne den Umweg
über die Tester also mit voller Reichweite. Für alles außer trivialen Fixes
lieber Schritt 2 und dann Schritt 3.

### Fingerprint: wann ein OTA-Update nicht reicht

`runtimeVersion` steht in `app.json` auf `policy: "fingerprint"`. Ein Update
wird nur ausgeliefert, wenn sein Fingerprint exakt dem des installierten
Builds entspricht — und der Fingerprint wird **pro Plattform** berechnet. Vor
dem Publish prüfen:

```bash
npm run preupdate:testflight            # prüft iOS und Android auf einmal
```

Das ist derselbe Check, der `update:*` ohnehin vorgeschaltet ist
(`scripts/check-fingerprint.ts`). Von Hand geht es auch:

```bash
eas build:list --platform android --build-profile testflight --limit 5
eas fingerprint:compare --build-id <BUILD-ID> --environment production
```

`--environment` muss zum Profil passen, sonst vergleichst du gegen andere
Env-Variablen. Ohne Build-ID zur Hand:

```bash
npx expo-updates runtimeversion:resolve --platform android
npx expo-updates fingerprint:generate --platform android   # inkl. Quellenliste
```

Den Fingerprint ändern unter anderem: `app.json`, `package.json` (ohne
`scripts`, siehe `fingerprint.config.js`), `.gitignore`, native Dependencies —
**und `eas.json`**, das `@expo/fingerprint` als ganze Datei mithasht und für das
es keinen `sourceSkip` gibt. Nach einer Änderung an einer dieser Dateien
erreichen OTA-Updates die bereits installierten Builds nicht mehr; es braucht
einen neuen Build.

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
eas channel:view testflight                  # welcher Branch hängt am Kanal
eas update:list --branch testflight          # zuletzt publizierte Updates
eas build:list --platform android --limit 5  # Builds inkl. IDs und Status
eas credentials --platform android           # Keystore und Service-Account-Key
```

## Android-Besonderheiten

**Keine Firebase-Konfiguration nötig.** Die App plant ausschließlich *lokale*
Benachrichtigungen (`src/notifications/`), keine Push-Nachrichten von einem
Server. Damit braucht es weder ein FCM-Projekt noch eine
`google-services.json`.

**`SCHEDULE_EXACT_ALARM`** steht in `app.json` unter `android.permissions`.
Die Erinnerungen (Deadline T-24h/T-3h/T-1h, Gebots-Ablauf T-30min/T-10min)
hängen daran. Zwei Dinge dazu:

- Für den Play Store ist die Berechtigung unkritisch. Die
  Deklarationspflicht und die enge Fallliste gelten für `USE_EXACT_ALARM`,
  nicht für `SCHEDULE_EXACT_ALARM`.
- Ab Android 14 wird sie neuen Apps aber nicht mehr automatisch gewährt,
  außer die App ist Wecker oder Kalender. Ohne Zustimmung fallen die
  Erinnerungen auf ungenaue Alarme zurück: sie kommen weiterhin, im
  Doze-Modus aber unter Umständen ein paar Minuten später. Bei Vorlaufzeiten
  ab zehn Minuten ist das verkraftbar.

**Der Berechtigungssatz ist bewusst zusammengestrichen.** Die Bare-Vorlage von
Expo bringt drei Berechtigungen mit, die als *"OPTIONAL PERMISSIONS, REMOVE
WHATEVER YOU DO NOT NEED"* markiert sind und die kickflow nirgends benutzt:
`SYSTEM_ALERT_WINDOW` sowie `READ_EXTERNAL_STORAGE` und
`WRITE_EXTERNAL_STORAGE`. Im Play-Eintrag stünden sie als "Über anderen Apps
einblenden" bzw. "Fotos und Medien" — deshalb liegen sie in `app.json` unter
`android.blockedPermissions` und werden beim Manifest-Merge entfernt.

Was übrig bleibt: `INTERNET`, `SCHEDULE_EXACT_ALARM` und aus dem
`expo-notifications`-Manifest `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`
und `VIBRATE`. Nachsehen lässt sich das jederzeit lokal:

```bash
npx expo prebuild --platform android --no-install --clean
grep uses-permission android/app/src/main/AndroidManifest.xml
```

Der Ordner `/android` ist generiert und in `.gitignore` — nach dem Blick
wieder löschen.

**Das Benachrichtigungsicon** ist ein eigenes Asset
(`assets/notification-icon.png`, im `expo-notifications`-Plugin in `app.json`
verdrahtet). Die Android-Statusleiste wertet nur den Alphakanal aus und färbt
die Silhouette selbst ein — ohne dieses File nimmt sie das App-Icon, und weil
das flächendeckend deckend ist, bliebe ein weißes Quadrat übrig. Erzeugt wird
es aus derselben Vektorquelle wie alle anderen Icons:

```bash
pip install pillow cairosvg && python3 scripts/generate-icons.py
```

**Edge-to-Edge** ist seit SDK 55 nicht mehr abschaltbar (das frühere
`edgeToEdgeEnabled` gibt es nicht mehr) — die Layouts arbeiten durchgehend mit
`react-native-safe-area-context`.
