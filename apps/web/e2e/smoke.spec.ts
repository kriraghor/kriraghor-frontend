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
  // Password first since 30 Oct 2026; the code is one tap away.
  await expect(page.getByLabel("Mobile, email or username")).toBeVisible();
  await page.getByTestId("use-code").click();
  await expect(page.getByLabel("Mobile number or email")).toBeVisible();
  await expect(page.getByTestId("create-account")).toHaveAttribute("href", /signup$/);
});

test("switches to Bangla without changing the URL", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "বাংলা" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("আবার স্বাগতম");
  await expect(page).toHaveURL(/\/sign-in$/);
});
