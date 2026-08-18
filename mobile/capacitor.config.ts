import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Stack OS — tenant iOS app (Capacitor shell around the production tenant PWA).
 *
 * The tenant experience is a Next.js server app, so the shell loads it live from
 * production and layers on the native pieces Apple expects: launch screen, icon,
 * camera/photo capture for request photos, and push notifications. Session is the
 * same secure HTTP-only cookie the browser uses (works in WKWebView, same origin).
 *
 * `allowNavigation` is pinned to our host so the app can't be navigated off-site.
 */
const config: CapacitorConfig = {
  appId: "us.stackstorage.tenant",
  appName: "Bedrock Work",
  webDir: "www", // local fallback shell (shown until the live URL loads)
  server: {
    url: "https://stack-os-six.vercel.app/tenant",
    cleartext: false,
    allowNavigation: ["stack-os-six.vercel.app"],
  },
  backgroundColor: "#0a0a0a",
  ios: {
    contentInset: "always",
    backgroundColor: "#0a0a0a",
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: "#0a0a0a",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
