import { expect, test } from "@playwright/test";

test("health endpoint answers", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toMatchObject({ status: "ok" });
});

test("runtime config is served without secrets (ADR-003)", async ({ request }) => {
  const res = await request.get("/env.js");
  expect(res.headers()["cache-control"]).toContain("no-store");
  const body = await res.text();
  expect(body).toMatch(/^window\.__ENV=\{.*"API_URL"/);
  expect(body).toContain('"GYM_URL"');
  expect(body).not.toMatch(/SECRET|PASSWORD/);
});

test("home renders, says what the system does and links to start and sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-title")).toBeVisible();
  await expect(page.getByTestId("start-free")).toHaveAttribute("href", /\/start$/);
  await expect(page.getByTestId("find-gym")).toHaveAttribute("href", /\/gyms$/);
  await page.getByRole("link", { name: /sign in/i }).first().click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByLabel("Mobile number or email")).toBeVisible();
});

test("switches to Bangla without changing the URL", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "বাংলা" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("আবার স্বাগতম");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("the public receipt page renders without sign-in and is never indexed (M24-FR-37)", async ({ page }) => {
  // A token with dots, like the real ones (v1.<id>.<sig>): the proxy must still route it.
  await page.goto("/r/v1.00000000-0000-0000-0000-000000000000.0123456789abcdef");
  await expect(page.getByTestId("public-receipt")).toBeVisible();
  await expect(page.getByTestId("public-receipt")).not.toHaveAttribute("data-state", "loading", { timeout: 15000 });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
