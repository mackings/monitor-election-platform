// Minimal runtime-caching service worker. Two jobs: (1) satisfy the
// browser's installability requirement for the "Download App" prompt
// (Chrome won't fire beforeinstallprompt without a registered SW with a
// fetch handler), and (2) let the field app's shell still open when
// there's no connection at all -- the offline queue (lib/offline/queue.ts)
// already handles saving form submissions/media offline, but that only
// helps once the app itself has loaded, which needs something to serve.
const CACHE_NAME = "monitor-runtime-v2";

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

// Next.js's App Router client-side transitions fetch an RSC payload
// tagged with a `_rsc=<hash>` query param that's different on every
// single navigation, even to the same route already visited moments
// ago. Caching/matching by the literal request URL means that cache
// entry can never be reused -- every offline tab switch is a guaranteed
// miss, which doesn't just fail to serve stale content, it makes Next's
// own client router fall back to a real browser navigation that *also*
// misses (nothing was ever cached under the plain, no-`_rsc` URL either)
// and lands on the browser's native offline error page, losing the
// entire app, not just that one page. Normalized here to a stable
// per-route key so any later visit -- another RSC navigation, Next's
// hard-navigation fallback, or a real reload -- hits (and refreshes) the
// same entry instead of missing every time. RSC-fragment and full-
// document responses are different formats for the same URL, so they're
// kept in separate slots rather than collapsed into one.
function cacheKeyFor(url) {
  const isRSC = url.searchParams.has("_rsc");
  return url.pathname + (isRSC ? "?__sw_rsc=1" : "");
}

// Network-first, falling back to whatever was last cached under that
// route's normalized key. API calls are excluded entirely -- those
// should fail fast and go through the app's own offline-queue handling,
// not get served a stale cached response that looks like a real answer.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  const cacheKey = cacheKeyFor(url);

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy));
        }
        return response;
      })
      .catch(() => caches.match(cacheKey).then((cached) => cached || Response.error())),
  );
});
