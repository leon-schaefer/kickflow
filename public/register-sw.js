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
// SPA-Seite. Deshalb aktiv vergleichen: Hash des geladenen Bundles gegen den
// einer frisch vom eigenen Server geholten index.html.
//
// Das ist kein Polling gegen Kickbase (siehe src/queries/queryClient.ts) —
// nur ein Request an die eigene, statisch gehostete Seite, unabhängig vom
// Cloudflare-Sperrrisiko dort.
window.addEventListener('load', () => {
  const currentScript = document.querySelector('script[src*="/_expo/static/js/web/entry-"]');
  const currentSrc = currentScript ? currentScript.getAttribute('src') : null;
  if (!currentSrc) return;

  function checkForUpdate() {
    fetch('/', { cache: 'no-store' })
      .then((res) => res.text())
      .then((html) => {
        const match = html.match(/\/_expo\/static\/js\/web\/entry-[^"']+\.js/);
        if (match && match[0] !== currentSrc) {
          window.dispatchEvent(new Event('kickflow:update-available'));
          clearInterval(intervalId);
          document.removeEventListener('visibilitychange', onVisible);
        }
      })
      .catch(() => {
        // Offline oder Netzwerkfehler — beim nächsten Intervall/Fokus erneut versuchen.
      });
  }

  function onVisible() {
    if (document.visibilityState === 'visible') checkForUpdate();
  }

  document.addEventListener('visibilitychange', onVisible);
  const intervalId = setInterval(checkForUpdate, 30 * 60 * 1000);
});
