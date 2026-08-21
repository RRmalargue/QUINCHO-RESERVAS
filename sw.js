const CACHE_NAME = 'quincho-cache-v18';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './assets/logo.svg',
  './assets/logo.jpg',
  './assets/quincho-main.jpg',
  './assets/quincho-pool.jpg',
  './assets/r_reflejadas_canva.svg',
  './assets/monograma_3r_canva.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Forzar activación inmediata de la nueva versión
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    self.clients.claim().then(() => { // Tomar control de las páginas abiertas al instante
      return caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      });
    })
  );
});

self.addEventListener('fetch', (e) => {
  // Evitar cachear llamadas a la API de Supabase
  if (e.request.url.includes('supabase.co')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Estrategia Network-First: intentar red primero para tener siempre la última versión.
  // Si no hay conexión (offline), usar el respaldo en caché.
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Si la respuesta es válida, clonarla y actualizar la caché
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red (offline), recuperar del caché
        return caches.match(e.request);
      })
  );
});
