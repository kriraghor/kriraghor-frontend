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

/**
 * The member area by section (31 Oct 2026). It needs a signed-in member, so it runs only when
 * E2E_MEMBER_ID and E2E_MEMBER_PASSWORD are set (a local stack with the demo seeder); CI's smoke run
 * has no API and skips it.
 */
const MEMBER = { id: process.env.E2E_MEMBER_ID, password: process.env.E2E_MEMBER_PASSWORD };

test.describe("member sections", () => {
  test.skip(!MEMBER.id || !MEMBER.password, "needs E2E_MEMBER_ID and E2E_MEMBER_PASSWORD and a running API");

  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in?next=/me");
    await page.getByLabel("Mobile, email or username").fill(MEMBER.id!);
    await page.getByLabel("Password", { exact: true }).fill(MEMBER.password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByTestId("me-dashboard")).toBeVisible({ timeout: 20_000 });
  });

  test("the rail shows the sections and a click shows the section's tabs", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const key of ["home", "esports", "events", "venues", "gym", "shop", "hire", "money", "help", "account"]) {
      await expect(page.getByTestId(`section-${key}`)).toBeVisible();
    }
    await expect(page.getByTestId("section-home")).toHaveAttribute("aria-current", "true");
    await page.getByTestId("section-events").click();
    await expect(page).toHaveURL(/\/me\/events$/);
    const tabs = page.getByTestId("section-tabs");
    await expect(tabs.getByTestId("me-tournaments")).toHaveAttribute("aria-current", "page");
    for (const id of ["me-teams", "me-player", "me-eligibility"]) await expect(tabs.getByTestId(id)).toBeVisible();
    await tabs.getByTestId("me-teams").click();
    await expect(page).toHaveURL(/\/me\/teams$/);
    await expect(tabs.getByTestId("me-teams")).toHaveAttribute("aria-current", "page");

    // Esports opens its landing on kriraghor.com; its tabs are marked as another site.
    await page.getByTestId("section-esports").click();
    await expect(page.getByTestId("esports-landing")).toBeVisible();
    await expect(page.getByTestId("me-esports")).toHaveAttribute("aria-label", /opens on another Kriraghor site/);

    // The old test ids still resolve, each on its section's tabs.
    const where: [string, string[]][] = [
      ["/me/bookings", ["me-bookings"]],
      ["/me/gym", ["me-passes", "me-subscriptions"]],
      ["/me/orders", ["me-orders", "me-saved"]],
      ["/me/hire", ["me-hire"]],
      ["/me/disputes", ["me-disputes"]],
      ["/account/settings", ["me-settings", "me-verification", "me-open-shop"]],
    ];
    for (const [path, ids] of where) {
      await page.goto(path);
      for (const id of ids) await expect(page.getByTestId(id)).toBeVisible();
    }

    // The rail collapses to icons and remembers it.
    await page.getByTestId("sidebar-toggle").click();
    await expect(page.getByTestId("section-shell")).toHaveAttribute("data-collapsed", "true");
    await page.reload();
    await expect(page.getByTestId("section-shell")).toHaveAttribute("data-collapsed", "true");
    await page.getByTestId("sidebar-toggle").click();
  });

  test("on a phone the section switcher opens a sheet of sections", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/me/bookings");
    await page.getByTestId("section-menu").click();
    const sheet = page.getByTestId("section-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("section-tile-venues")).toHaveAttribute("aria-current", "true");
    await sheet.getByTestId("section-tile-help").click();
    await expect(page).toHaveURL(/\/me\/disputes$/);
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId("me-disputes")).toHaveAttribute("aria-current", "page");
  });
});
