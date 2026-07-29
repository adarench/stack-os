/**
 * Tear down this device's web-push subscription on sign-out. Best-effort: never
 * blocks or throws — a logged-out (possibly shared) device must not keep
 * receiving the previous user's notifications, but a cleanup hiccup must never
 * prevent the sign-out itself. `keepalive` lets the DELETE finish across the
 * navigation that sign-out triggers.
 */
export async function unsubscribePush(deleteUrl: string): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch(deleteUrl, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
      keepalive: true,
    }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  } catch {
    /* best-effort — never block sign-out */
  }
}
