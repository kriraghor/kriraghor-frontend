import { expect, test } from "@playwright/test";
import { closeMenu, openMenu } from "./menu";

// Prefetched pages stay in the browser under the same URL in both languages. The header's links are
// prefetched on load, so wait for one before switching. The switch is in the menu drawer, which is
// closed again before the header link is clicked.
test("a page prefetched before the language switch opens in the new language", async ({ page }) => {
  const prefetched = page.waitForResponse((res) => new URL(res.url()).pathname === "/venues" && res.url().includes("_rsc="));
  await page.goto("/about");
  await prefetched;
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await openMenu(page);
  await page.getByTestId("language-switch").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await closeMenu(page);

  // The main links: in the header, or in their own row under it when the header has a search.
  await page.getByTestId("site-nav").locator('a[href="/venues"]').first().click();
  await expect(page).toHaveURL(/\/venues$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.locator("h1").first()).not.toHaveText("Venues open today");
});

test("the language switch keeps the URL, query string included", async ({ page }) => {
  await page.goto("/about?from=test");
  await openMenu(page);
  await page.getByTestId("language-switch").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page).toHaveURL(/\/about\?from=test$/);
});

// Tester feedback, 28 Nov 2026: switching language turned the site dark (the theme mark on <html> was lost),
// and typed text was gone in the other language.
test("the language switch keeps the theme and typed text", async ({ page, context }) => {
  await context.addCookies([{ name: "kg_theme", value: "light", url: "http://localhost:3000" }]);
  await page.goto("/sign-in");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.locator("main #identifier").fill("01300000090");
  await openMenu(page);
  await page.getByTestId("language-switch").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("main:visible #identifier")).toHaveValue("01300000090");
});
