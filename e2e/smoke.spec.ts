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
  expect(body).not.toMatch(/SECRET|PASSWORD/);
});

test("home renders and links to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-title")).toBeVisible();
  await page.getByRole("link", { name: /sign in/i }).first().click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("tab", { name: /phone code/i })).toBeVisible();
});

test("switches to Bangla without changing the URL", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "বাংলা" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ক্রীড়াঘরে সাইন ইন করুন");
  await expect(page).toHaveURL(/\/sign-in$/);
});
