import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const plugins = [react()] as const;

export default defineConfig({
  plugins: plugins as unknown as any,
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
