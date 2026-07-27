/* Stack OS service worker — web-push delivery + offline shell (PWA-002).
 *
 * Two jobs: (1) receive push events so internal techs get immediate awareness
 * of assigned work even when the PWA is closed, and focus/open the right screen
 * on click; (2) provide a minimal offline experience — precache the app icons +
 * an offline fallback, and serve that fallback when a navigation fails with no
 * network. We deliberately do NOT cache authenticated HTML/API responses (that
 * would risk cross-user data leaks under the RLS model); the fallback is a
 * static "you're offline" page. Bump CACHE to invalidate the precache.
 */

const CACHE = "stack-os-shell-v1";
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  // Precache the offline shell, then activate immediately so a freshly
  // registered SW can receive pushes and serve the fallback right away.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Drop stale precaches from older SW versions.
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Navigations: network-first, fall back to the offline page when the network
  // is unreachable. Never serve a cached authenticated document.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  // Precached static shell assets (icons/manifest): cache-first for instant,
  // offline-safe loads. Everything else falls through to the network untouched.
  const url = new URL(req.url);
  if (url.origin === self.location.origin && PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Stack OS", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Stack OS";
  const options = {
    body: data.body || "",
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || "/my" },
    // No `badge` — it must be a monochrome image URL; pointing it at the
    // .webmanifest silently failed to decode. Omit until a real badge PNG exists.
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/my";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab and route it to the target if possible.
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(url);
            return undefined;
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
