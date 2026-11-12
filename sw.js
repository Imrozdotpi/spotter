/*
 * Spotter service worker: makes the app work offline after the first visit.
 *
 * - It only ever touches requests to this site's own address (same origin).
 *   Spotter makes no other requests, and this file would not serve them anyway.
 * - The page itself (HTML) is fetched from the network first, so updates show
 *   up when you are online, and falls back to the saved copy when you are not.
 * - Scripts, icons and the manifest are served from the saved copy first.
 *
 * WHEN YOU CHANGE ANY FILE LISTED BELOW, RAISE THE VERSION NUMBER.
 * That makes phones drop the old saved copies and fetch the new ones.
 */
const VERSION = "spotter-v1";

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
    caches.open(VERSION).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
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

  if (isPage) {
    // Network first, saved copy as the offline fallback.
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then(cache => cache.put("./index.html", copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  // Static files: saved copy first, network only if it is not saved yet.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then(cache => cache.put(req, copy));
      }
      return res;
    }))
  );
});
