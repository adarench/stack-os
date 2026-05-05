import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["../test/**/*.test.ts"],
    environment: "node",
    setupFiles: ["../test/setup-env.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@db": path.resolve(__dirname, "src/db"),
      "@contracts": path.resolve(__dirname, "src/contracts"),
      "@inngest": path.resolve(__dirname, "src/inngest"),
      "server-only": path.resolve(__dirname, "../test/server-only.ts"),
    },
  },
});
