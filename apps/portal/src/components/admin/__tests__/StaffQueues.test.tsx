import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en.json";
import bn from "../../../../messages/bn.json";
import type { ActionItem } from "@/lib/dashboard";
import { StaffQueues } from "../StaffQueues";

// M19-FR-29 (dashboards round 3): one card per staff queue, urgent ones marked in words, and the all-clear card.
vi.mock("@kriraghor/ui/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
});

const mount = (items: ActionItem[], locale: "en" | "bn" = "en") =>
  act(() =>
    root.render(
      <NextIntlClientProvider locale={locale} messages={locale === "bn" ? bn : en} timeZone="Asia/Dhaka">
        <StaffQueues items={items} />
      </NextIntlClientProvider>,
    ),
  );

const items: ActionItem[] = [
  { key: "reports_open", count: 2, severity: "normal", dueAt: null, href: "/admin/reports" },
  { key: "disputes_to_review", count: 12, severity: "high", dueAt: "2026-11-25T06:00:00.000Z", href: "/admin/disputes" },
];

describe("StaffQueues", () => {
  it("shows a card per queue, urgent first, each opening its desk", () => {
    mount(items);
    const cards = [...host.querySelectorAll<HTMLAnchorElement>("[data-testid^='queue-']")];
    expect(cards.map((c) => c.dataset.testid)).toEqual(["queue-disputes_to_review", "queue-reports_open"]);
    expect(cards[0].getAttribute("href")).toBe("/admin/disputes");
    expect(cards[0].textContent).toContain("12");
    expect(cards[0].textContent).toContain("Disputes to decide");
    expect(cards[0].textContent).toContain("Urgent");
    expect(cards[0].textContent).toMatch(/Due Wed/);
    expect(cards[1].textContent).not.toContain("Urgent");
    expect(cards[1].textContent).toContain("Open the desk");
  });

  it("shows the all-clear card when nothing waits", () => {
    mount([]);
    expect(host.querySelector("[data-testid='admin-all-clear']")).not.toBeNull();
    expect(host.querySelector("[data-testid='staff-queues']")).toBeNull();
  });

  it("uses Bangla words and digits in Bangla", () => {
    mount(items, "bn");
    const first = host.querySelector("[data-testid='queue-disputes_to_review']")!;
    expect(first.textContent).toContain("১২");
    expect(first.textContent).toContain("সিদ্ধান্তের অপেক্ষায় বিরোধ");
  });
});
