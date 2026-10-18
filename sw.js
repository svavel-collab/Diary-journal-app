const CACHE_NAME = 'journal-cache-supabase-v3';
const urlsToCache = [
    './',
    './index.html',
    './app.js',
    './style.css',
    './manifest.json',
    './ikon.png'
];

// Installera Service Worker och cacha grundfiler
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// Aktivera och rensa gamla cachar
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Hantera nätverksanrop
self.addEventListener('fetch', event => {
    // VIKTIGT: Släpp igenom alla anrop till Supabase direkt till nätverket utan att cacha
    if (event.request.url.includes('supabase.co')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Returnera från cache om den finns, annars hämta från nätverket
                return response || fetch(event.request);
            })
    );
});
