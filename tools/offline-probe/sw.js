// Caches only the probe's own static files (synthetic). Never caches API responses.
const CACHE = "makarba-offline-probe-v1";
const SHELL = ["./", "./index.html", "./probe.js", "./app.js"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then((r) => r, () => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit ? new Response(hit.body, { headers: { ...Object.fromEntries(hit.headers), "x-served-from": "service-worker-cache" } }) : Response.error())));
});
