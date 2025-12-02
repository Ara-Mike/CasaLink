// sw.js - UPDATED VERSION
const CACHE_NAME = 'casalink-pwa-v3.0.2';
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/style.css',
    '/config/firebase.js',
    '/js/app.js',
    '/js/auth.js',
    '/js/dataManager.js',
    '/js/modalManager.js',
    '/js/pwaManager.js',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Skip admin pages from being cached
const ADMIN_PATHS = ['/admin/', '/admin/', 'admin.html'];

// Install event
self.addEventListener('install', (event) => {
    console.log('🚀 Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Caching app shell');
                return cache.addAll(URLS_TO_CACHE);
            })
            .then(() => {
                console.log('✅ App shell cached successfully');
                return self.skipWaiting();
            })
    );
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('🎯 Service Worker: Activating...');
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('🗑️ Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Take control of clients but NOT immediately
            self.clients.claim().then(() => {
                console.log('✅ Service Worker activated');
            })
        ]).catch((error) => {
            console.error('❌ Service Worker activation error:', error);
        })
    );
});

// Fetch event - Skip admin pages
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const path = url.pathname;
    
    // Skip admin pages from service worker control
    for (const adminPath of ADMIN_PATHS) {
        if (path.includes(adminPath)) {
            console.log('🔒 Skipping admin page from service worker:', path);
            return; // Let browser handle admin pages
        }
    }
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // For HTML pages, always try network first
    if (event.request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache the fresh version
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, responseClone));
                    return response;
                })
                .catch(() => {
                    // Network failed, try cache
                    return caches.match(event.request)
                        .then(cachedResponse => cachedResponse || caches.match('/index.html'));
                })
        );
        return;
    }
    
    // For other resources, cache-first
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request)
                    .then(response => response)
                    .catch(() => new Response('Offline'));
            })
    );
});

// Message event
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});