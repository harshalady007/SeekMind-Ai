import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against demo mode (mock providers, in-memory store) so they
 * never spend external API credits and are fully deterministic.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    // The execution environment pre-installs Chromium here; using it directly
    // avoids re-downloading browsers when versions drift.
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH || process.env.PLAYWRIGHT_BROWSERS_PATH
      ? {
          launchOptions: {
            executablePath:
              process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
          },
        }
      : {}),
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      grepInvert: /@mobile/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      grep: /@mobile/,
    },
  ],
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    port: 3100,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      DEMO_MODE: "true",
      SEARCH_PROVIDER: "mock",
      NEXT_PUBLIC_APP_URL: "http://localhost:3100",
      PORT: "3100",
      // All test traffic shares one IP; don't trip the abuse limiter.
      SEARCHES_PER_MINUTE_PER_IP: "1000",
    },
  },
});
