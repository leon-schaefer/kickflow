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
    .then((text) => (text ? text.trim() : null))
    .catch(() => {
      // Offline oder Netzwerkfehler — beim nächsten Intervall/Fokus erneut versuchen.
      return null;
    });
}
