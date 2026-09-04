// Minimal PWA service worker: makes the app installable and usable offline
// after a first visit. Hashed bundle files under /assets/ never change content
// under the same URL, so they're safe to cache-first; everything else
// (index.html, manifest, icons) is network-first so a redeploy is picked up
// immediately whenever the device is online.
//
// `/assets/` ist Vites Ausgabepfad (build.assetsDir in vite.config.ts) und hiess
// vor dem Umzug von Expo auf Vite `/_expo/`. Deshalb der Sprung auf v2: `activate`
// loescht jeden Cache, der nicht CACHE_NAME heisst, und raeumt damit die alten
// /_expo/-Einträge bei bestehenden Installationen weg statt sie liegen zu lassen.
//
// Umgekehrt darf unter public/ nie ein Verzeichnis assets/ entstehen: dessen Inhalt
// landet unveraendert in dist/assets/ und wuerde hier cache-first behandelt, obwohl
// er keinen Content-Hash traegt.
const CACHE_NAME = 'kickflow-v2';
const IMMUTABLE_PATH = '/assets/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith(IMMUTABLE_PATH)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        cache.put(event.request, response.clone());
        return response;
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(event.request);
        cache.put(event.request, response.clone());
        return response;
      } catch (error) {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        throw error;
      }
    })
  );
});
