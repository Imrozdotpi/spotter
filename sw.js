/*
 * Spotter service worker: makes the app work offline after the first visit.
 *
 * - It only ever touches requests to this site's own address (same origin).
 *   Spotter makes no other requests, and this file would not serve them anyway.
 * - EVERYTHING is fetched from the network first (and re-checked with the server, so the
 *   browser's own cache cannot hand back an old copy). That means a changed script or page
 *   shows up on the next load whenever you are online.
 * - The saved copy is only the fallback when the network fails, which is what makes the app
 *   open in aeroplane mode.
 * - Raising VERSION below is no longer needed for updates to appear. It still clears old
 *   saved copies, so raise it when files are removed or renamed.
 */
const VERSION = "spotter-v5";

const ASSETS = [
  "./",
  "./index.html",
  "./src/spotter-config.js",
  "./src/spotter-core.js",
  "./src/spotter-demo.js",
  "./src/spotter-ui.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon-180.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSION)
      // cache: "reload" skips the browser's HTTP cache, so the saved copies are the server's current files
      .then(cache => Promise.all(ASSETS.map(url => cache.add(new Request(url, { cache: "reload" })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("spotter-") && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never handle anything off this site

  const isPage = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  const network = isPage ? fetch(req) : fetch(req, { cache: "no-cache" }); // no-cache = always ask the server if the file changed

  event.respondWith(
    network
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(cache => cache.put(isPage ? "./index.html" : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (isPage ? caches.match("./index.html") : undefined)))
  );
});
