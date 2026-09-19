// SohoJ Clinic — service worker
// Caches the app shell so the interface still loads with no connection.
// Data (queue, patients, etc.) is NOT cached here — that stays in IndexedDB
// via the app's own offline-queue logic in index.html, because the cloud
// database (Supabase) remains the source of truth, per item 26.

const CACHE_NAME = 'sohoj-clinic-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Network-first for navigation/app shell (so updates are picked up when
// online), falling back to cache when offline. Everything else (CDN
// libraries, Supabase API calls) passes straight through to the network —
// we deliberately do not cache third-party or data requests here.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isShellRequest = url.origin === self.location.origin;
  if (!isShellRequest || req.method !== 'GET') return; // let everything else go to the network normally

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(()=>{});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
