import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './frontend/tests',
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npm run dev -- --hostname 0.0.0.0 --port 3100',
    cwd: 'apps/web/ether-pod',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_ETHOS_GATEWAY: 'http://localhost:65535',
      NEXT_PUBLIC_ETHOS_TOKEN: 'playwright-token',
      NEXT_PUBLIC_ETHOS_USER_ID: 'playwright-user',
      NEXT_PUBLIC_ETHOS_DISPLAY_NAME: 'Playwright User',
      NEXT_PUBLIC_ECO_API_URL: 'http://localhost:65535',
    },
  },
});
