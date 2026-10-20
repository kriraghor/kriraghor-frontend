// Playwright preset for the smoke tests against a production build (`next start`). In CI the API is
// not running, so they only check what the app serves on its own. Set BASE_URL to test a deployed app.
import { devices } from "@playwright/test";

/**
 * @param {number} defaultPort
 * @returns {import("@playwright/test").PlaywrightTestConfig}
 */
export function playwrightPreset(defaultPort) {
  const port = Number(process.env.PORT ?? defaultPort);
  const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;
  return {
    testDir: "e2e",
    timeout: 30_000,
    retries: process.env.CI ? 1 : 0,
    use: { baseURL, trace: "retain-on-failure" },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: process.env.BASE_URL
      ? undefined
      : { command: `npm run start -- -p ${port}`, url: `${baseURL}/api/health`, reuseExistingServer: !process.env.CI, timeout: 60_000 },
  };
}
