/* service-worker.js — minimal offline support.
   The app is already static + localStorage, so this just caches the app
   shell and data so it still opens with no signal mid-workout. */

const CACHE_NAME = 'quest-log-v2';

const CORE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/xp.js',
  './js/confetti.js',
  './js/app.js',
  './quest-data.json',
  './manifest.webmanifest',
  './assets/icons/icon.svg',
  './assets/badges/first_hang.png',
  './assets/badges/squad_leader.png',
  './assets/badges/iron_grip.png',
  './assets/badges/steady_base.png',
  './assets/badges/full_turn.png',
  './assets/badges/first_ascent.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for same-origin GET requests, falling back to network,
// and updating the cache in the background when possible.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
