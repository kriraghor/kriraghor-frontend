import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import { ShareButton } from "../share/ShareButton";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The share strings live in the app message files; the test brings its own copy.
const messages = { ...en, kit: { ...en.kit, share: { label: "Share", copy: "Copy link", copied: "Link copied", copyFailed: "Could not copy", whatsapp: "WhatsApp", facebook: "Facebook", messenger: "Messenger", x: "X" } } };

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete (navigator as { share?: unknown }).share;
});

function render(variant: "button" | "icon" = "button") {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="Asia/Dhaka">
        <ShareButton url="https://kriraghor.com/hiring/rafi" title="Rafi Ahmed" text="Umpire, Mirpur" variant={variant} testId="hire-share" />
      </NextIntlClientProvider>,
    ),
  );
  return host.querySelector<HTMLButtonElement>('[data-testid="hire-share"]')!;
}

describe("ShareButton", () => {
  it("opens the device's share sheet with the ref-tagged URL when there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    const button = render();
    expect(button.textContent).toBe("Share");
    await act(async () => button.click());
    expect(share).toHaveBeenCalledWith({ title: "Rafi Ahmed", text: "Umpire, Mirpur", url: "https://kriraghor.com/hiring/rafi?ref=share" });
  });

  it("is a menu button without a native share sheet", () => {
    const button = render();
    expect(button.getAttribute("aria-haspopup")).toBe("menu");
  });

  it("the icon variant is labelled for screen readers", () => {
    const button = render("icon");
    expect(button.getAttribute("aria-label")).toBe("Share");
  });
});
