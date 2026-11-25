import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en.json";
import ui from "../../../../../../packages/ui/messages/en.json";
import type { ReviewFigures as Data } from "@/lib/admin/reviews";
import { TooltipProvider } from "@kriraghor/ui/kit";

// M19-FR-33: "Your reviews" on the admin home: the tiles, Me or Team, the latest decisions for Me only.
const push = vi.fn();
vi.mock("@kriraghor/ui/i18n/navigation", () => ({ useRouter: () => ({ push }) }));
const fetchFigures = vi.fn();
vi.mock("@/lib/admin/reviews", async (orig) => ({ ...(await orig<typeof import("@/lib/admin/reviews")>()), reviewFigures: (...a: unknown[]) => fetchFigures(...a) }));

import { ReviewFigures } from "../ReviewFigures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: q.includes("min-width"), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  fetchFigures.mockReset();
  push.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const data = (over: Partial<Data> = {}): Data => ({
  scope: "me",
  window: { days: 30, from: "2026-10-27", to: "2026-11-25" },
  tiles: {
    waiting: { value: 7, delta: null, note: { overdue: 2 } },
    reviewedToday: { value: 6, delta: 50, note: { lastWeek: 4 } },
    medianMinutes: { value: 95, delta: -10 },
    approvalRate: { value: 0.8, delta: 5 },
  },
  perDay: [{ day: "2026-11-25", approved: 4, changesRequested: 1, rejected: 1 }],
  whyNo: [{ code: "photos_unclear", label: "Photos unclear or not of the item", count: 2 }],
  recent: [{ submissionId: "11111111-1111-4111-8111-111111111111", kind: "ground", decision: "rejected", reasonCode: "photos_unclear", reason: "Photos unclear or not of the item", decidedAt: "2026-11-25T06:00:00.000Z" }],
  asOf: "2026-11-25T08:30:00.000Z",
  definitions: { review_waiting: "w", reviewed_today: "r", median_decision: "m", approval_rate: "a", decisions_per_day: "d", why_no: "y" },
  ...over,
});

async function mount(scope: "me" | "team", onScope = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{ ...ui, ...en }} timeZone="Asia/Dhaka">
          <TooltipProvider>
            <ReviewFigures scope={scope} onScope={onScope} />
          </TooltipProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return onScope;
}
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

describe("ReviewFigures", () => {
  it("shows the four tiles with the queue's overdue note and the median as hours and minutes; my latest decisions open the item", async () => {
    fetchFigures.mockResolvedValue(data());
    await mount("me");
    expect(fetchFigures).toHaveBeenCalledWith("me", "en");
    expect(q("tile-review-waiting")!.textContent).toContain("2 overdue");
    expect(q("tile-reviewed-today")!.textContent).toContain("6");
    expect(q("tile-median")!.textContent).toContain("1 h 35 min");
    expect(q("tile-approval")!.textContent).toContain("80");
    const row = q("recent-decision")!;
    expect(row.textContent).toContain("Rejected");
    act(() => row.click());
    expect(push).toHaveBeenCalledWith("/admin/moderation?id=11111111-1111-4111-8111-111111111111");
  });

  it("Team leaves out the latest decisions, and the switch tells the page", async () => {
    fetchFigures.mockResolvedValue(data({ scope: "team", recent: [] }));
    const onScope = await mount("team");
    expect(fetchFigures).toHaveBeenCalledWith("team", "en");
    expect(q("recent-decisions")).toBeNull();
    act(() => q("reviews-me")!.click());
    expect(onScope).toHaveBeenCalledWith("me");
  });

  it("says so when the figures could not load", async () => {
    fetchFigures.mockRejectedValue(new Error("down"));
    await mount("me");
    expect(q("review-figures")!.textContent).toContain(en.dashboard.loadFailed);
  });
});
