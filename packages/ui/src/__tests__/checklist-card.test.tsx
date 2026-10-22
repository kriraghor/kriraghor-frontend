import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";

// App routes go through next-intl's Link; here a plain anchor stands in for it.
vi.mock("../i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} data-app-link="true" {...rest}>
      {children}
    </a>
  ),
}));
const { ChecklistCard } = await import("../kit/ChecklistCard");

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

function render(node: ReactNode) {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        {node}
      </NextIntlClientProvider>,
    ),
  );
}

describe("ChecklistCard (Round B1)", () => {
  it("shows the score bar and links each step to do to where it is fixed", () => {
    const onPhoto = vi.fn();
    render(
      <ChecklistCard
        title="Finish your profile"
        score={40}
        testId="pc"
        steps={[
          { key: "photo", label: "Add a photo", done: false, onSelect: onPhoto },
          { key: "headline", label: "Write a headline", done: true, href: "/pro/profiles/1#pro-headline" },
          { key: "rates", label: "Set your rates", done: false, href: "/pro/profiles/1", hint: "Managers see them first" },
          { key: "bio", label: "Bio", done: false, href: "#pro-bio" },
          { key: "uid", label: "Game UID", done: false, href: "/go/esports/me/esports" },
          { key: "later", label: "Later", done: false },
        ]}
      />,
    );
    const card = host.querySelector('[data-testid="pc"]')!;
    expect(card.getAttribute("role")).toBe("region");
    const bar = host.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect(bar.getAttribute("aria-valuetext")).toBe("40% complete");
    expect(card.textContent).toContain("1 of 6 done");

    const step = (k: string) => host.querySelector(`[data-testid="pc-step-${k}"]`)!;
    expect(step("headline").getAttribute("data-done")).toBe("true");
    expect(step("headline").querySelector("a")).toBeNull();
    expect(step("headline").textContent).toContain("Done");
    expect(step("rates").querySelector("a")!.getAttribute("href")).toBe("/pro/profiles/1");
    expect(step("rates").querySelector("a")!.getAttribute("data-app-link")).toBe("true");
    expect(step("rates").textContent).toContain("Managers see them first");
    expect(step("rates").textContent).toContain("To do");
    // Anchors on the page and other sites are plain links.
    expect(step("bio").querySelector("a")!.getAttribute("data-app-link")).toBeNull();
    expect(step("uid").querySelector("a")!.getAttribute("href")).toBe("/go/esports/me/esports");
    expect(step("later").querySelector("a, button")).toBeNull();

    act(() => step("photo").querySelector("button")!.click());
    expect(onPhoto).toHaveBeenCalledOnce();
  });

  it("hides itself at 100% unless asked to stay, and keeps the score within 0–100", () => {
    render(<ChecklistCard title="Done" score={100} testId="pc" steps={[{ key: "a", label: "A", done: true }]} />);
    expect(host.querySelector('[data-testid="pc"]')).toBeNull();
    render(<ChecklistCard title="Done" score={140} keepWhenComplete testId="pc" steps={[{ key: "a", label: "A", done: true }]} />);
    expect(host.querySelector('[role="progressbar"]')!.getAttribute("aria-valuenow")).toBe("100");
    render(<ChecklistCard title="Start" score={-5} description="Why it matters" steps={[{ key: "a", label: "A", done: false, href: "/x" }]} />);
    expect(host.querySelector('[role="progressbar"]')!.getAttribute("aria-valuenow")).toBe("0");
    expect(host.querySelector('[data-testid="checklist"]')!.textContent).toContain("Why it matters");
  });
});
