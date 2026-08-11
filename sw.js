/* Luma (Android/PWA) service worker — made by its.austin
   Caches the app shell so Luma launches offline and installs to the home
   screen. It never caches your audio: songs are referenced in place from the
   phone and streamed by the browser directly, never copied. */
const CACHE = "luma-shell-v1";
const SHELL = [
  "index.html",
  "manifest.webmanifest",
  "css/styles.css",
  "js/app.js",
  "js/db.js",
  "lib/jsmediatags.min.js",
  "icon.png",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // only handle same-origin app-shell requests; let blob:/audio/fonts pass through
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match("index.html"));
    })
  );
});
