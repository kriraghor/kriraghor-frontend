import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LogoMark } from "../brand/LogoMark";
import { SOCIAL_PROFILES, SocialLinks } from "../brand/SocialLinks";

describe("LogoMark", () => {
  it("stacks the three pieces, with both inks so the black parts can follow the theme", () => {
    const html = renderToStaticMarkup(<LogoMark size={36} />);
    for (const piece of ["logo-stem.png", "logo-stem-dark.png", "logo-lower.png", "logo-lower-dark.png", "logo-upper.png"]) expect(html).toContain(`/brand/${piece}`);
    expect(html).not.toContain("logo-bottle");
    expect(html).toContain('aria-hidden="true"');
  });

  it("names its motion and the always-dark band in its classes; the new K has no ring to ripple", () => {
    expect(renderToStaticMarkup(<LogoMark motion="live" onBand />)).toMatch(/kg-live.*kg-on-band/);
    expect(renderToStaticMarkup(<LogoMark motion="join" />)).toMatch(/kg-join/);
    expect(renderToStaticMarkup(<LogoMark motion="join" />)).not.toContain("kg-ring");
  });

  it("is an image with a name only when it is given one", () => {
    expect(renderToStaticMarkup(<LogoMark label="Kriraghor" />)).toContain('aria-label="Kriraghor"');
  });
});

describe("SocialLinks", () => {
  it("links every official profile over https, in a new tab, with its name", () => {
    const html = renderToStaticMarkup(<SocialLinks label="Kriraghor on social media" />);
    expect(SOCIAL_PROFILES.map((p) => p.key)).toEqual(["facebook", "instagram", "youtube", "tiktok", "linkedin", "x"]);
    for (const p of SOCIAL_PROFILES) {
      expect(p.href.startsWith("https://")).toBe(true);
      expect(html).toContain(`href="${p.href}"`);
      expect(html).toContain(`aria-label="${p.name}"`);
    }
    expect(html.match(/target="_blank"/g)).toHaveLength(6);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(6);
  });
});
