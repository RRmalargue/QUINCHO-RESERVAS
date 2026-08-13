const CACHE_NAME = 'quincho-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './bookings.json',
  './manifest.json',
  './assets/logo.svg',
  './assets/quincho-main.jpg',
  './assets/quincho-pool.jpg',
  './assets/r_reflejadas_canva.svg',
  './assets/monograma_3r_canva.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
