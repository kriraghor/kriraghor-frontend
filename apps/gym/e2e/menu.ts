import { expect, type Page } from "@playwright/test";

/**
 * Opens the header's menu drawer (SiteHeader: `menu-button` → `site-menu`), where the language switch lives
 * since the header redesign. A click can land before the page has hydrated, so try again until the drawer opens.
 */
export async function openMenu(page: Page) {
  const menu = page.getByTestId("site-menu");
  await expect(async () => {
    if (!(await menu.isVisible())) await page.getByTestId("menu-button").click({ timeout: 1000 });
    await expect(menu).toBeVisible({ timeout: 1000 });
  }).toPass();
}

/** Closes the drawer (Escape), so the page behind it is reachable again. */
export async function closeMenu(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("site-menu")).toBeHidden();
}
