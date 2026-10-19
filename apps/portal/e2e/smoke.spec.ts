import { expect, test } from "@playwright/test";

test("health endpoint answers", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
});

test("runtime config is served without secrets (ADR-003)", async ({ request }) => {
  const body = await (await request.get("/env.js")).text();
  expect(body).toMatch(/^window\.__ENV=\{.*"API_URL"/);
  expect(body).not.toMatch(/SECRET|PASSWORD/);
});

test("the admin area requires a staff sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Staff sign-in");
});

test("the other area is not reachable on this host", async ({ request }) => {
  const res = await request.get("/vendor", { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});
