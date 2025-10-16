import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    viewport: { width: 1280, height: 720 },
  },
  reporter: [["list"], ["html", { outputFolder: "./playwright-report", open: "never" }]],
});
