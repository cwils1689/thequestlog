/* service-worker.js — minimal offline support.
   The app is already static + localStorage, so this just caches the app
   shell and data so it still opens with no signal mid-workout. */

const CACHE_NAME = 'quest-log-v3';

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
      .then((cache) => Promise.all(
        // {cache: 'reload'} bypasses the browser's HTTP cache so a fresh
        // deploy can never get baked in stale — without this, addAll() can
        // silently pick up an old disk-cached copy of a file and pin it.
        CORE_ASSETS.map((url) => fetch(url, { cache: 'reload' }).then((res) => {
          if (res.ok) return cache.put(url, res);
        }).catch(() => {}))
      ))
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

// Network-first for same-origin GET requests, falling back to the cache
// only when offline. This means an online device always gets the latest
// deploy; the cache exists purely as an offline fallback mid-workout.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
