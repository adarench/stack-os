/* Stack OS service worker — web-push delivery.
 *
 * Minimal by design: it exists to receive push events (so internal techs get
 * immediate awareness of assigned work even when the PWA is closed) and to
 * focus/open the right screen on click. No offline caching yet.
 */

self.addEventListener("install", () => {
  // Activate immediately so a freshly-registered SW can receive pushes.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
