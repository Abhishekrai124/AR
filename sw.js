const CACHE = "arrai-shell-v5";
const SHELL = ["/", "/index.html", "/style.css", "/script.js", "/lib/arrai-core.js", "/makima-core.html", "/makima-core.js", "/manifest.webmanifest", "/assets/app-icon.svg"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const client = clients.find((item) => new URL(item.url).origin === self.location.origin);
    if (client) {
      await client.navigate(target);
      return client.focus();
    }
    return self.clients.openWindow(target);
  }));
});
self.addEventListener("fetch", (event) => { const url = new URL(event.request.url); if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return; event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html")))); });
