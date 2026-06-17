// PWA service worker for the internal Production Tracker.
// It is intentionally online-first and only caches static shell files/icons.
// Database-backed API routes are not intercepted, so Render/Turso requests keep
// using the live network path and do not serve stale production data.
const PWA_CACHE_NAME = "production-tracker-static-v2";
const STATIC_PATHS = new Set([
  "/",
  "/index.html",
  "/admin.html",
  "/access.html",
  "/app.js",
  "/admin.js",
  "/pwa-install.js",
  "/employees.js",
  "/dispensary-locations.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
]);

self.addEventListener("install", event => {
  // Activate updated PWA behavior promptly after the browser installs it.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  // Remove old static caches while leaving API/database responses untouched.
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== PWA_CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isStaticAsset = STATIC_PATHS.has(url.pathname) || url.pathname.startsWith("/icons/");
  if (!isStaticAsset) {
    // Do not handle API routes such as /schedule, /ordered-items, /admin/*, etc.
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(PWA_CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
