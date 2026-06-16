import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["../test/**/*.test.ts"],
    environment: "node",
    setupFiles: ["../test/setup-env.ts"],
    // Integration tests share one Neon branch; each file opens its own
    // connections. Unbounded file parallelism exhausts Neon's connection
    // limit and the suite flakes with hook/test timeouts. Cap concurrent
    // test files so the suite is deterministic (each file is still fast).
    poolOptions: {
      forks: { maxForks: 2, minForks: 1 },
    },
  },
  resolve: {
    alias: {
      // Must precede "@" — stub the Auth.js config so next-auth (which imports
      // next/server) never loads in the node test env. Tests mock the wrapper.
      "@/auth": path.resolve(__dirname, "../test/auth-stub.ts"),
      "@": path.resolve(__dirname, "src"),
      "@db": path.resolve(__dirname, "src/db"),
      "@contracts": path.resolve(__dirname, "src/contracts"),
      "@inngest": path.resolve(__dirname, "src/inngest"),
      "server-only": path.resolve(__dirname, "../test/server-only.ts"),
    },
  },
});
