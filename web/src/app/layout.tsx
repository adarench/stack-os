import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

export const metadata: Metadata = {
  metadataBase: new URL("https://stack-os-six.vercel.app"),
  title: "Stack OS",
  description: "Maintenance + Compliance Operating System",
  manifest: "/manifest.webmanifest",
  applicationName: "Stack OS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Stack OS",
  },
  // PWA-001 installability: Chrome reads the manifest icons; iOS home-screen
  // needs an explicit apple-touch-icon link (it ignores the manifest).
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Do not disable zoom — pinch-to-zoom is a WCAG 2.1 AA requirement (SC 1.4.4)
  // and a mobile-web-app "feel" does not require locking scale on modern iOS/Android.
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
