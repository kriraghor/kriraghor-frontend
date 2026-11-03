import { expect, test } from "@playwright/test";

// Prefetched pages stay in the browser under the same URL in both languages. The header's links are
// prefetched on load, so wait for one before switching.
test("a page prefetched before the language switch opens in the new language", async ({ page }) => {
  const prefetched = page.waitForResponse((res) => new URL(res.url()).pathname === "/venues" && res.url().includes("_rsc="));
  await page.goto("/about");
  await prefetched;
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByTestId("language-switch").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");

  await page.locator('header a[href="/venues"]').first().click();
  await expect(page).toHaveURL(/\/venues$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.locator("h1").first()).not.toHaveText("Venues open today");
});

test("the language switch keeps the URL, query string included", async ({ page }) => {
  await page.goto("/about?from=test");
  await page.getByTestId("language-switch").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page).toHaveURL(/\/about\?from=test$/);
});
