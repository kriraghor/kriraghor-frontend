import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests against a production build (`next start`). In CI the API is not running, so these
 * only check what the app serves on its own: pages render, /env.js and /api/health work.
 * Set BASE_URL to run them against a deployed app (e.g. http://kriraghor.localhost).
 */
const port = Number(process.env.PORT ?? 3002);
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: `npm run start -- -p ${port}`, url: `${baseURL}/api/health`, reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
