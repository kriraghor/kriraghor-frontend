import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText, isMobileUserAgent, shareLinks, waNumber, whatsappChatUrl, whatsappUrl, withRef } from "../share/links";

describe("withRef", () => {
  it("adds ref=share to a plain URL", () => {
    expect(withRef("https://kriraghor.com/hiring/rafi")).toBe("https://kriraghor.com/hiring/rafi?ref=share");
  });

  it("keeps the existing query and the hash", () => {
    expect(withRef("https://kriraghor.com/venues/abc?date=2026-10-21&t=1#slots")).toBe("https://kriraghor.com/venues/abc?date=2026-10-21&t=1&ref=share#slots");
  });

  it("replaces an existing ref instead of adding a second one", () => {
    expect(withRef("https://esports.kriraghor.com/p/x?ref=home&a=b")).toBe("https://esports.kriraghor.com/p/x?ref=share&a=b");
  });

  it("takes another ref value", () => {
    expect(withRef("https://kriraghor.com/shop/p/ball", "qr")).toBe("https://kriraghor.com/shop/p/ball?ref=qr");
  });

  it("appends by hand to a relative URL, keeping its query and hash", () => {
    expect(withRef("/events/cup")).toBe("/events/cup?ref=share");
    expect(withRef("/events/cup?tab=fixtures&ref=old#top")).toBe("/events/cup?tab=fixtures&ref=share#top");
  });
});

describe("whatsappUrl", () => {
  it("encodes the whole message", () => {
    expect(whatsappUrl("Join Gulshan Gladiators: https://kriraghor.com/teams/join/abc?x=1&y")).toBe(
      "https://wa.me/?text=Join%20Gulshan%20Gladiators%3A%20https%3A%2F%2Fkriraghor.com%2Fteams%2Fjoin%2Fabc%3Fx%3D1%26y",
    );
  });
});

describe("whatsappChatUrl (M27-FR-32, M24-FR-158)", () => {
  it("reads a Bangladesh mobile in every form: local, 880 and E.164", () => {
    expect(whatsappChatUrl("01712345678", "x")).toBe("https://wa.me/8801712345678?text=x");
    expect(whatsappChatUrl("8801712345678", "x")).toBe("https://wa.me/8801712345678?text=x");
    expect(whatsappChatUrl("+8801712345678", "x")).toBe("https://wa.me/8801712345678?text=x");
    expect(whatsappChatUrl("+880 1712-345678", "x")).toBe("https://wa.me/8801712345678?text=x");
    expect(waNumber("019 1234 5678")).toBe("8801912345678");
  });

  it("gives null for a number that is not a Bangladesh mobile", () => {
    for (const bad of ["12345", "01212345678", "+4407911123456", "017123456789", "", null, undefined]) expect(whatsappChatUrl(bad, "x")).toBeNull();
    expect(waNumber("0171234567")).toBeNull();
  });

  it("encodes the message, Bangla and links included", () => {
    expect(whatsappChatUrl("+8801712345678", "Hi Iron House, ৳1,500 & more: https://gym.kriraghor.com/gyms/iron?a=1&b")).toBe(
      "https://wa.me/8801712345678?text=Hi%20Iron%20House%2C%20%E0%A7%B31%2C500%20%26%20more%3A%20https%3A%2F%2Fgym.kriraghor.com%2Fgyms%2Firon%3Fa%3D1%26b",
    );
    expect(whatsappChatUrl("01712345678", "আসসালামু আলাইকুম")).toBe(`https://wa.me/8801712345678?text=${encodeURIComponent("আসসালামু আলাইকুম")}`);
  });
});

describe("isMobileUserAgent", () => {
  it("knows phones from desktops", () => {
    expect(isMobileUserAgent("Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36")).toBe(true);
    expect(isMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(true);
    expect(isMobileUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129 Safari/537.36")).toBe(false);
    expect(isMobileUserAgent(undefined)).toBe(false);
  });
});

describe("shareLinks", () => {
  const url = "https://kriraghor.com/hiring/rafi?ref=share";

  it("WhatsApp gets 'title url', Facebook the URL, X both; no Messenger on a desktop", () => {
    const links = shareLinks(url, "Rafi Ahmed · Umpire");
    expect(links.map((l) => l.key)).toEqual(["whatsapp", "facebook", "x"]);
    expect(links[0].href).toBe(`https://wa.me/?text=${encodeURIComponent(`Rafi Ahmed · Umpire ${url}`)}`);
    expect(links[1].href).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
    const x = new URL(links[2].href);
    expect(x.origin + x.pathname).toBe("https://x.com/intent/tweet");
    expect(x.searchParams.get("url")).toBe(url);
    expect(x.searchParams.get("text")).toBe("Rafi Ahmed · Umpire");
  });

  it("adds the Messenger app link on phones", () => {
    const links = shareLinks(url, "Rafi", { mobile: true });
    expect(links.map((l) => l.key)).toEqual(["whatsapp", "facebook", "messenger", "x"]);
    expect(links[2].href).toBe(`fb-messenger://share/?link=${encodeURIComponent(url)}`);
  });

  it("without text, WhatsApp gets the URL alone and X has no text", () => {
    const links = shareLinks(url, "  ");
    expect(links[0].href).toBe(`https://wa.me/?text=${encodeURIComponent(url)}`);
    expect(new URL(links[links.length - 1].href).searchParams.has("text")).toBe(false);
    expect(shareLinks(url, null)[0].href).toBe(`https://wa.me/?text=${encodeURIComponent(url)}`);
  });
});

describe("copyText", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  afterEach(() => {
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else delete (navigator as { clipboard?: unknown }).clipboard;
    vi.restoreAllMocks();
  });
  const setClipboard = (value: unknown) => Object.defineProperty(navigator, "clipboard", { value, configurable: true });
  const setExec = (fn: () => boolean) => Object.defineProperty(document, "execCommand", { value: vi.fn(fn), configurable: true, writable: true });

  it("uses the Clipboard API when it is there", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await expect(copyText("https://kriraghor.com/x")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://kriraghor.com/x");
  });

  it("falls back to execCommand when the Clipboard API refuses, and cleans up the textarea", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    setExec(() => true);
    await expect(copyText("hello")).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back when there is no Clipboard API, and reports a failed copy", async () => {
    setClipboard(undefined);
    setExec(() => false);
    await expect(copyText("hello")).resolves.toBe(false);
    setExec(() => {
      throw new Error("no");
    });
    await expect(copyText("hello")).resolves.toBe(false);
    expect(document.querySelector("textarea")).toBeNull();
  });
});
