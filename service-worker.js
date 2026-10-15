const CACHE_NAME = 'xswift-shell-v3';
const APP_ROOT = new URL('./', self.registration.scope);
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './config.js?v=3',
  './src/styles.css?v=7',
  './src/main.js',
  './src/car-app.js',
  './src/car-drive.js',
  './src/car-sheets.js',
  './src/car-sync.js',
  './src/google-auth.js',
  './src/legacy-import.js',
  './icons/xswift-icon.svg',
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
    const cached = await cache.match(request);
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (error) {
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return (await cache.match(APP_ROOT.toString())) || (await cache.match(new URL('./index.html', APP_ROOT).toString()));
      }
      throw error;
    }
  })());
});

