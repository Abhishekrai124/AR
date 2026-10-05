const CACHE = "arrai-shell-v6";
const SHELL = [
  "/",
  "/index.html",
  "/founder.html",
  "/auth.html",
  "/style.css",
  "/founder.css",
  "/script.js",
  "/founder.js",
  "/founder-live.js",
  "/manifest.webmanifest",
  "/assets/app-icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("arrai-shell-") && key !== CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) return;

  event.respondWith(
    fetch(request).then((response) => {
      const isShellResource = SHELL.includes(url.pathname);
      const contentType = response.headers.get("content-type") || "";
      const expectedType = url.pathname.endsWith(".js")
        ? contentType.includes("javascript")
        : url.pathname.endsWith(".css")
          ? contentType.includes("text/css")
          : url.pathname.endsWith(".html") || url.pathname === "/"
            ? contentType.includes("text/html")
            : true;
      if (response.ok && isShellResource && expectedType) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        return new Response("ARRAI is offline. Please reconnect and try again.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      return Response.error();
    }),
  );
});
