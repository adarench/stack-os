import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // PWA: serve manifest from /public; service worker added in P1.
};

export default nextConfig;
