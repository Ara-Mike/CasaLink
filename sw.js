self.addEventListener('install', (event) => {
    console.log('🚀 Service Worker: INSTALLING - Skipping waiting immediately');
    self.skipWaiting(); // Force activation without waiting
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    console.log('🎯 Service Worker: ACTIVATING - Claiming clients immediately');
    event.waitUntil(
        Promise.all([
            self.clients.claim(), // Take control of all pages
            self.skipWaiting() // Skip any waiting phase
        ]).then(() => {
            console.log('✅ Service Worker: ACTIVATED and CONTROLLING');
        })
    );
});


const CACHE_NAME = 'casalink-pwa-v3.0.0';
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

// Install event - Force immediate activation
self.addEventListener('install', (event) => {
  console.log('🚀 Service Worker: Installing and activating immediately...');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching app shell');
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => {
        console.log('✅ App shell cached successfully');
        return self.skipWaiting(); // Force activation
      })
  );
});

// Activate event - Take control immediately
self.addEventListener('activate', (event) => {
  console.log('🎯 Service Worker: Activating and claiming clients...');
  
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
      // Take control of all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activated and controlling page!');
      // Send message to all clients that we're ready
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_CONTROLLING',
            message: 'Service Worker is now controlling the page'
          });
        });
      });
    })
  );
});

// Fetch event - Simple cache-first strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and browser extensions
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then((response) => {
            // Cache successful responses
            if (response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return response;
          })
          .catch(() => {
            // Network failed - return offline page for HTML
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            return new Response('Offline');
          });
      })
  );
});

// Message event - Handle communication from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});