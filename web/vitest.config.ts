import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["../test/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@db": path.resolve(__dirname, "../db"),
      "@contracts": path.resolve(__dirname, "../contracts"),
      "@inngest": path.resolve(__dirname, "../inngest"),
      "server-only": path.resolve(__dirname, "../test/server-only.ts"),
    },
  },
});
