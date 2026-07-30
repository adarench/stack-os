"use client";

import { useEffect } from "react";

/**
 * Registers the tenant iOS app for native APNs push. No-op everywhere except
 * inside the Capacitor shell (guarded by isNativePlatform, so the plain web PWA
 * and SSR are unaffected — the plugin is only imported on a real device).
 *
 * On launch it asks permission, registers, POSTs the APNs device token to the
 * backend (`/api/tenant/push/apns`), and deep-links into the tapped work order.
 * Re-registering on each launch repoints the token to the current resident, so a
 * shared device stops delivering the previous user's pushes after they sign in.
 */
export function NativePushRegister() {
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (disposed || !Capacitor.isNativePlatform()) return;
        const { PushNotifications } = await import("@capacitor/push-notifications");

        // Listen before register() so the first token isn't missed.
        await PushNotifications.addListener("registration", (t) => {
          void fetch("/api/tenant/push/apns", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: t.value, platform: "ios" }),
            keepalive: true,
          }).catch(() => undefined);
        });
        await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const url = action?.notification?.data?.url;
          if (typeof url === "string" && url.startsWith("/")) window.location.href = url;
        });

        const perm = await PushNotifications.requestPermissions();
        if (perm.receive === "granted") await PushNotifications.register();
      } catch {
        /* not a native shell / plugin unavailable — plain web, do nothing */
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);

  return null;
}
