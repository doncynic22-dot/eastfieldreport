/**
 * Service Worker for Eastfield Academy School Management System
 * Provides offline caching for static assets, scripts, styles, and core database records.
 */

const CACHE_VERSION = 'eastfield-v2-stock-portal';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

// Core static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event: Pre-cache shell assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline app shell');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Pre-cache partial warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate event: Clean up old cache versions and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== STATIC_CACHE && key !== DATA_CACHE) {
            console.log('[ServiceWorker] Removing stale cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Determine if request is a static asset
function isStaticAsset(url) {
  return (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot|json|webp)$/i) ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/src/') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  );
}

// Helper: Determine if request is a Supabase or data API request
function isDataRequest(url) {
  return (
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/api/') ||
    url.hostname.includes('supabase.co')
  );
}

// Fetch event handler with smart offline fallbacks
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests for caching
  if (request.method !== 'GET') {
    return;
  }

  // Strategy 1: HTML Navigation Requests -> Network-first with /index.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline, serve cached index.html or root
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const fallback = await caches.match('/index.html') || await caches.match('/');
          if (fallback) return fallback;
          return new Response('Offline - Eastfield Academy School Management System is running in offline mode.', {
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // Strategy 2: Supabase Data API Requests -> Network-first with Data Cache fallback
  if (isDataRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          console.log('[ServiceWorker] Network unavailable, retrieving cached data for:', url.pathname);
          const cachedData = await caches.match(request);
          if (cachedData) return cachedData;
          return new Response(JSON.stringify({ status: 'offline', cached: false, data: [] }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Strategy 3: Static Assets (JS, CSS, Fonts, Images) -> Stale-While-Revalidate
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const copy = networkResponse.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Strategy 4: Default Network with Cache Fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Listen for message events from clients to cache core database records directly
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'CACHE_CORE_DATABASE_SNAPSHOT') {
    const { payload, timestamp } = event.data;
    caches.open(DATA_CACHE).then((cache) => {
      const response = new Response(JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
          'X-Offline-Cached-At': timestamp || new Date().toISOString()
        }
      });
      cache.put(new Request('/offline-core-database-snapshot'), response);
      console.log('[ServiceWorker] Successfully saved core database snapshot to offline cache');
    });
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
