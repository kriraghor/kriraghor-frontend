import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { reapplyTheme, storedTheme, ThemeKeeper } from "../brand/ThemeKeeper";
import { THEME_COOKIE, THEME_KEY } from "../brand/theme-keys";

// Tester feedback, 28 Nov 2026: switching language turned the gym site dark (React rendered <html> again
// without data-theme). The keeper puts the visitor's pick back.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.cookie = `${THEME_COOKIE}=; path=/; max-age=0`;
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("theme keeper", () => {
  it("reads the cookie first, then this site's copy", () => {
    expect(storedTheme()).toBeNull();
    localStorage.setItem(THEME_KEY, "dark");
    expect(storedTheme()).toBe("dark");
    document.cookie = `${THEME_COOKIE}=light; path=/`;
    expect(storedTheme()).toBe("light");
  });

  it("puts the pick back, or the site's fallback; with neither it leaves the system's", () => {
    reapplyTheme();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    reapplyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    document.cookie = `${THEME_COOKIE}=light; path=/`;
    reapplyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("restores the attribute when <html> loses it", async () => {
    document.cookie = `${THEME_COOKIE}=light; path=/`;
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<ThemeKeeper fallback="dark" />));
    expect(document.documentElement.dataset.theme).toBe("light");
    delete document.documentElement.dataset.theme; // what the language switch did
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(document.documentElement.dataset.theme).toBe("light");
    act(() => root.unmount());
  });
});
