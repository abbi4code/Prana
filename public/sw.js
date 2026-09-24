// Offline support (decision D02). Hand-written instead of Serwist so it works with Turbopack.
// Pages: network first, cached copy when offline. Build assets: cache first (they're content-hashed).
const VERSION = "v2";
const PAGES = ["/", "/progress", "/me", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(`pages-${VERSION}`).then((c) => c.addAll(PAGES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(`pages-${VERSION}`).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa-icon/") || /\.(png|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(`assets-${VERSION}`).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
  }
});
