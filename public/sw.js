// Lumin Vocab service worker: offline app shell and word list.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
const VERSION = "lumin-v3.2.1";
const SHELL = [
  "/", "/index.html", "/app.css", "/manifest.webmanifest", "/data/words.json", "/data/trails.json", "/404.html", "/art/grain.png",
  "/js/app.js", "/js/views.js", "/js/model.js", "/js/store.js", "/js/sync.js", "/js/srs.js", "/js/device.js", "/js/ui.js", "/js/scan.js", "/js/vendor/qrcode.mjs",
  "/js/art.js", "/js/sound.js", "/js/wordsheet.js", "/js/words.js", "/js/journey.js", "/js/practice.js", "/js/games.js", "/js/library.js", "/js/you.js", "/js/motion.js",
  "/icons/logo.svg", "/icons/favicon.svg", "/icons/app-192.png", "/icons/app-apple-180.png",
  "/fonts/literata-latin-400-normal.woff2", "/fonts/literata-latin-600-normal.woff2", "/fonts/literata-latin-400-italic.woff2",
  "/fonts/atkinson-hyperlegible-latin-400-normal.woff2", "/fonts/atkinson-hyperlegible-latin-700-normal.woff2",
];
self.addEventListener("install", (e) => {
  // Always fetch fresh copies (skip the HTTP cache) so a new version is never built from stale files
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // Pages: network first, so a fresh visit always gets the latest page; the cached copy is the offline fallback
  if (e.request.mode === "navigate") {
    const isApp = url.pathname === "/" || url.pathname === "/index.html";
    e.respondWith(fetch(e.request).then((r) => {
      // Only a good copy of the app page itself becomes the offline copy (never the privacy page or a 404)
      if (isApp && r.ok && r.type === "basic") { const copy = r.clone(); caches.open(VERSION).then((c) => c.put("/index.html", copy)); }
      return r;
    }).catch(() => caches.open(VERSION).then((c) => c.match(url.pathname, { ignoreSearch: true }).then((hit) => hit || c.match("/index.html")))));
    return;
  }
  // Files: served from this version's cache (all files of one version always match), filled from the network when missing
  e.respondWith(caches.open(VERSION).then((c) => c.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }))));
});
