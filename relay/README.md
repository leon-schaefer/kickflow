# Verschlüsselter Kickbase-Tunnel auf Render Free

Der Browser führt TLS mit libcurl.js aus. Dieses Relay leitet lediglich
Binärdaten über einen TCP-Socket zu `api.kickbase.com:443` weiter. Es verwendet
weder `fetch` noch einen TLS-Client. Es hat keine Schlüssel für Zugangsdaten,
Token oder API-Antworten. Client-IP, Zielhost, Zeitpunkt und Datenvolumen sind
für Relay und Hoster weiterhin sichtbar. Der Betreiber des ausgelieferten
Frontends bleibt eine Vertrauensstelle.

## Render bereitstellen

1. Die geprüften Änderungen auf einen freigegebenen Git-Branch pushen.
2. In Render **New → Blueprint** dieses Repository und diesen Branch wählen.
   `render.yaml` definiert einen einzelnen **Free Web Service** in Frankfurt,
   ohne Datenbank, Volume oder kostenpflichtige Zusatzdienste. Alternativ:
   Web Service, Node, Root Directory `relay`, Build `npm ci --omit=dev`,
   Start `npm start`, Health Check `/health`, Instance Type **Free**.
3. `ALLOWED_ORIGINS` muss die exakten Frontend-Origins enthalten, durch Kommas
   getrennt. Vorgabe: `https://www.kickflow.online,https://kickflow.online`.
   Zusätzliche Vercel-Previews einzeln freigeben, kein `*` verwenden.
4. Die tatsächlich zugewiesene `https://…onrender.com`-Adresse notieren.
   Der Name `kickflow-tunnel.onrender.com` im Repository ist ein **Beispiel**,
   keine reservierte oder nachgewiesen eigene Adresse.
5. In Vercel `VITE_TUNNEL_URL` auf diese HTTPS-Origin setzen, ohne
   Pfad oder Geheimnisse. In `vercel.json` den Beispielhost durch dieselbe
   HTTPS- und WSS-Origin ersetzen. Der Produktionsbuild prüft diese Kopplung
   und bricht bei fehlender/abweichender Konfiguration ab.
6. Frontend neu bauen und deployen. `/health` muss die Protokollkennung
   `{"service":"kickflow-tunnel","protocol":"wsproxy","version":1}` liefern.
   Danach einen Browser-Test gegen genau dieses Deployment durchführen.

Automatische Render-Deploys sind in der Blueprint-Vorlage ausgeschaltet.
Ein neuer Deploy erfolgt bewusst nach Prüfung. Keine Kickbase-Zugangsdaten,
Token, Render-API-Schlüssel oder Vercel-Secrets in die Frontend-Variablen schreiben.

## Verhalten bei Render Free

Nach 15 Minuten ohne eingehenden Traffic kann Render den Dienst stoppen.
Das Aufwachen kann etwa eine Minute dauern. Die App prüft auf Nutzeraktion
bis zu 90 Sekunden ausschließlich `/health`, ohne Zugangsdaten und ohne
Hintergrund-Keepalive. Erst danach beginnt der API-Timeout. Ein HTML-
Startbildschirm zählt nicht als betriebsbereites Relay. Abgebrochene Aufrufe
werden nach dem Aufwachen nicht nachträglich gesendet.

Jede API-Anfrage nutzt eine eigene TLS-Sitzung. Nach dem vollständigen Lesen
der Antwort oder bei Abbruch wird sie geschlossen. Der Tunnel wiederholt
keine API-Anfrage; insbesondere Gebote, Verkäufe und Aufstellungsänderungen
werden nach einem unklaren Verbindungsabbruch nicht automatisch neu gesendet.

## Lokale Entwicklung

```sh
npm ci --prefix relay
ALLOWED_ORIGINS=http://localhost:5173 PORT=10000 npm --prefix relay start
```

In `.env.local`:

```dotenv
VITE_TUNNEL_URL=http://localhost:10000
```

HTTP/WS ist nur für Loopback-Adressen erlaubt. Ohne die Variable nutzt der
Dev-Server den bisherigen direkten API-Zugriff. Ein Produktionsbuild erfordert
eine freigegebene Tunnel-Adresse; einen stillen Rückfall auf einen HTTP-Proxy
gibt es nicht.

## Prüfungen

```sh
npm ci
npm ci --prefix relay
npm run typecheck
npm test
VITE_TUNNEL_URL=https://kickflow-tunnel.onrender.com npm run build:web
```

Der letzte Aufruf prüft den **Beispielhost**, keine Bereitstellung. Für den
echten Betrieb die eigene Render-Adresse verwenden.

`npm run test:relay` prüft echte lokale WebSocket-/TCP-Verbindungen, enge
Origin-/Zielprüfung, private DNS-Antworten, unveränderte Binärweiterleitung
und Ressourcenlimits. Browser-/TLS-Prüfungen stehen in
`scripts/verify/tunnel.mjs`; sie benötigen eine vorhandene Playwright-Installation.

Das Relay bindet an Render `$PORT` auf `0.0.0.0`. Es erlaubt höchstens 128
gleichzeitige Verbindungen, 24 je IP, 256 KiB je WebSocket-Nachricht und
32 MiB je Verbindung. Nach 60 Sekunden TCP-Leerlauf oder zehn Minuten
wird eine Verbindung beendet. Es verbindet sich mit der zuvor geprüften
öffentlichen DNS-Adresse; private, reservierte und Loopback-Ziele werden
abgewiesen. Origin-Prüfung ist kein Geheimnis und keine Authentifizierung
gegen fremde Clients. Die Grenzen begrenzen Missbrauch, verhindern ihn aber
nicht vollständig. Render-Free-Limits und Datenverkehr bleiben zu überwachen.
