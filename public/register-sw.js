if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

// Update-Erkennung für offen gebliebene Tabs/PWA-Instanzen: sw.js selbst
// ändert sich zwischen Deploys praktisch nie (statischer Dateiinhalt), daher
// feuert der reguläre Service-Worker-Lifecycle (waiting/controllerchange)
// hier so gut wie nie. Die eigentliche Update-Zustellung läuft stattdessen
// über network-first index.html + hash-benannte Bundles in sw.js — das greift
// aber nur bei einer echten Neu-Navigation, nicht in einer bereits offenen
// SPA-Seite. Deshalb aktiv vergleichen: die von scripts/write-build-id.ts vor
// jedem Export geschriebene build-id.txt gegen eine frisch vom eigenen Server
// geholte Kopie.
//
// build-id.txt (statt z. B. des Bundle-Dateinamens) macht das unabhängig von
// Expos Ausgabepfad — ändert sich der (Code-Splitting, Bundler-Update), bleibt
// der Update-Check trotzdem funktionsfähig statt still nie wieder zu greifen.
//
// Das ist kein Polling gegen Kickbase (siehe src/queries/queryClient.ts) —
// nur ein Request an die eigene, statisch gehostete Seite, unabhängig vom
// Cloudflare-Sperrrisiko dort.

// Muss zu src/updates/buildId.ts passen (formatBuildId): Zeitstempel, optional
// mit verkürzter Commit-SHA. src/updates/registerSw.test.ts füttert diesen
// Check mit echter formatBuildId-Ausgabe, ein Formatwechsel fliegt also im
// Test auf und nicht erst still in Produktion.
const BUILD_ID_PATTERN = /^\d{8}T\d{6}Z(?:-[0-9a-f]{7,40})?$/;

window.addEventListener('load', () => {
  // Baseline erst beim ersten erfolgreichen Fetch setzen, nicht synchron beim
  // Laden — bei einem flakey Request auf die eigene Seite soll der Check beim
  // nächsten Intervall/Fokus einfach erneut versuchen, statt für die ganze
  // Tab-Lebensdauer stumm zu bleiben. Erst wenn wiederholt gar keine
  // build-id.txt zu bekommen ist, wird das laut gemeldet (siehe unten).
  let initialBuildId = null;
  let missCount = 0;
  let warned = false;

  function checkForUpdate() {
    fetchBuildId().then((buildId) => {
      if (!buildId) {
        missCount += 1;
        if (missCount >= 3 && !warned) {
          warned = true;
          console.warn('kickflow: build-id.txt wiederholt nicht lesbar — Web-Update-Check gestört.');
        }
        return;
      }
      missCount = 0;

      if (!initialBuildId) {
        initialBuildId = buildId;
        return;
      }

      if (buildId !== initialBuildId) {
        window.dispatchEvent(new Event('kickflow:update-available'));
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', onVisible);
      }
    });
  }

  function onVisible() {
    if (document.visibilityState === 'visible') checkForUpdate();
  }

  document.addEventListener('visibilitychange', onVisible);
  checkForUpdate();
  const intervalId = setInterval(checkForUpdate, 30 * 60 * 1000);
});

function fetchBuildId() {
  return fetch('/build-id.txt', { cache: 'no-store' })
    .then((res) => (res.ok ? res.text() : null))
    .then((text) => {
      const buildId = text ? text.trim() : null;
      // Fehlt build-id.txt im Deploy, greift der SPA-Rewrite aus vercel.json
      // und liefert index.html mit Status 200 — ohne Formatprüfung ginge eine
      // ganze HTML-Seite als Build-ID durch und der Check würde je nach
      // Bundle-Hash zufällig feuern oder nie. Alles, was nicht wie eine
      // Build-ID aussieht, zählt deshalb als Fehlschlag und wird nach drei
      // Versuchen gemeldet.
      return buildId && BUILD_ID_PATTERN.test(buildId) ? buildId : null;
    })
    .catch(() => {
      // Offline oder Netzwerkfehler — beim nächsten Intervall/Fokus erneut versuchen.
      return null;
    });
}
