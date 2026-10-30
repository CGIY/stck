const CACHE = "stck-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(["./offline.html", "./icon-192.png"])),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("stck-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  // Never cache account data, auth responses, or HTML containing sign-in tokens.
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./offline.html")),
    );
});
self.addEventListener("push", (event) => {
  let payload = {
    title: "STCK",
    body: "Une nouvelle t’attend dans ta bibliothèque.",
    tag: "stck",
  };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {}
  const url = new URL("./index.html", self.registration.scope).href;
  event.waitUntil(
    self.registration.showNotification(String(payload.title).slice(0, 100), {
      body: String(payload.body).slice(0, 300),
      tag: String(payload.tag).slice(0, 120),
      icon: new URL("./icon-192.png", self.registration.scope).href,
      badge: new URL("./icon-192.png", self.registration.scope).href,
      data: { url },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL("./index.html", self.registration.scope).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        const existing = clients.find((client) =>
          client.url.startsWith(self.registration.scope),
        );
        if (existing) {
          await existing.navigate(url);
          return existing.focus();
        }
        return self.clients.openWindow(url);
      }),
  );
});
