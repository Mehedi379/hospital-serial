/*
 * Service worker — makes the Assistant panel installable as an app (PWA) and
 * lets the app shell open instantly / offline. Live data (patients, doctors,
 * socket.io) is ALWAYS fetched fresh from the network — we only cache the
 * static shell (html/js/icons), never the API responses.
 */
const CACHE = 'hospital-shell-v5';
const SHELL = [
  '/assistant.html',
  '/theme.js',
  '/vendor/tailwind.js',
  '/translit.js',
  '/avatars.js',
  '/customselect.js',
  '/printer.js',
  '/logo-transparent.webp',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Never cache API, socket.io, or the TTS audio — always live.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;
  if (e.request.method !== 'GET') return;
  // Network-first for the shell so updates land, cache as offline fallback.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/assistant.html')))
  );
});
