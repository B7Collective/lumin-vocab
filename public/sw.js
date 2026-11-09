// Lumin Vocab service worker: offline app shell and word list.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
const VERSION = "lumin-v1.0.0";
const SHELL = [
  "/", "/index.html", "/app.css", "/manifest.webmanifest", "/data/words.json", "/404.html",
  "/js/app.js", "/js/views.js", "/js/model.js", "/js/store.js", "/js/sync.js", "/js/srs.js", "/js/device.js", "/js/ui.js", "/js/vendor/qrcode.mjs",
  "/icons/logo.svg", ...["morning", "sunny", "garden", "harbor", "blossom", "night", "dusk", "forest"].map((t) => `/scenes/${t}.svg`), "/icons/favicon.svg", "/icons/icon-192.png", "/icons/apple-touch-icon.png",
  "/fonts/literata-latin-400-normal.woff2", "/fonts/literata-latin-600-normal.woff2", "/fonts/literata-latin-400-italic.woff2",
  "/fonts/atkinson-hyperlegible-latin-400-normal.woff2", "/fonts/atkinson-hyperlegible-latin-700-normal.woff2",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // Pages: network first so updates show up, cache as the offline fallback
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put("/index.html", copy)); return r; })
      .catch(() => caches.match("/index.html")));
    return;
  }
  // Everything else: cache first, refresh in the background
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => {
    const net = fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
