// Minimal runtime-caching service worker. Two jobs: (1) satisfy the
// browser's installability requirement for the "Download App" prompt
// (Chrome won't fire beforeinstallprompt without a registered SW with a
// fetch handler), and (2) let the field app's shell still open when
// there's no connection at all -- the offline queue (lib/offline/queue.ts)
// already handles saving form submissions/media offline, but that only
// helps once the app itself has loaded, which needs something to serve.
const CACHE_NAME = "monitor-runtime-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first, falling back to whatever was last cached for that exact
// request. API calls are excluded entirely -- those should fail fast and
// go through the app's own offline-queue handling, not get served a
// stale cached response that looks like a real answer.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error())),
  );
});
