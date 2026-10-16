const CACHE_NAME = 'xswift-shell-v32';
const APP_ROOT = new URL('./', self.registration.scope);
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest?v=2',
  './config.js?v=6',
  './src/styles.css?v=23',
  './src/main.js?v=30',
  './fuel-prices.json',
  './src/car-app.js?v=5',
  './src/car-drive.js?v=2',
  './src/car-sheets.js?v=2',
  './src/car-sync.js?v=2',
  './src/xswift-api.js?v=4',
  './src/service-history.js',
  './src/legacy-import.js',
  './icons/xswift-icon.svg?v=2',
  './icons/ptt-logo.png',
  './icons/bangchak-logo.svg',
  './icons/caltex-logo.png',
  './icons/xswift-180.png',
  './icons/xswift-192.png',
  './icons/xswift-512.png',
  './icons/xswift-512-maskable.png'
].map(path => new URL(path, APP_ROOT).toString());

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(APP_ROOT.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (request.mode === 'navigate') {
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh.ok) await cache.put(request, fresh.clone());
        return fresh;
      } catch (_) {
        return (await cache.match(request)) || (await cache.match(new URL('./index.html', APP_ROOT).toString()));
      }
    }
    try {
      const fresh = await fetch(request, { cache: 'no-store' });
      if (fresh.ok) await cache.put(request, fresh.clone());
      return fresh;
    } catch (_) {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw new Error('Offline resource unavailable');
    }
  })());
});

