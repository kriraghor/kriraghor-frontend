import { afterEach, describe, expect, it } from "vitest";
import { THEME_COOKIE, THEME_KEY, themeCookie, themeCookieDomain, themeScript } from "../brand/ThemeScript";

// One theme for every Kriraghor site (tester feedback, 19 Nov 2026): a cookie on the shared parent domain.
const clear = () => {
  document.cookie = `${THEME_COOKIE}=; path=/; max-age=0`;
  localStorage.clear();
  delete document.documentElement.dataset.theme;
};
const run = (fallback?: "light" | "dark") => new Function(themeScript(fallback))();

describe("theme cookie", () => {
  afterEach(clear);

  it("is shared on the parent of the Kriraghor sites, staging and k3d included", () => {
    expect(themeCookieDomain("gym.kriraghor.com")).toBe("kriraghor.com");
    expect(themeCookieDomain("www.kriraghor.com")).toBe("kriraghor.com");
    expect(themeCookieDomain("ESPORTS.kriraghor.com")).toBe("kriraghor.com");
    expect(themeCookieDomain("kriraghor.com")).toBe("kriraghor.com");
    expect(themeCookieDomain("admin.staging.kriraghor.com")).toBe("staging.kriraghor.com");
    expect(themeCookieDomain("vendor.kriraghor.localhost")).toBe("kriraghor.localhost");
  });

  it("stays on the host where there is no shared parent", () => {
    expect(themeCookieDomain("localhost")).toBeNull();
    expect(themeCookieDomain("127.0.0.1")).toBeNull();
    expect(themeCookieDomain("[::1]")).toBeNull();
    expect(themeCookieDomain("kriraghor-web-abc.vercel.app")).toBe("kriraghor-web-abc.vercel.app");
  });

  it("writes a year-long cookie, Secure on https", () => {
    expect(themeCookie("dark", "gym.kriraghor.com", true)).toBe(`${THEME_COOKIE}=dark; path=/; max-age=31536000; SameSite=Lax; domain=kriraghor.com; Secure`);
    expect(themeCookie("light", "localhost", false)).toBe(`${THEME_COOKIE}=light; path=/; max-age=31536000; SameSite=Lax`);
  });

  it("applies the cookie before the first paint, over this site's own copy", () => {
    document.cookie = `${THEME_COOKIE}=light; path=/`;
    localStorage.setItem(THEME_KEY, "dark");
    run("dark");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("copies an older pick from localStorage to the cookie once", () => {
    localStorage.setItem(THEME_KEY, "dark");
    run();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
  });

  it("uses the site's default, or the system, when nothing was picked", () => {
    run("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    clear();
    run();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
