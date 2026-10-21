import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import { DataTable, sortRows, type Column } from "../kit/DataTable";
import { FilterBar, SEARCH_DEBOUNCE_MS } from "../kit/FilterBar";
import { ReasonDialog } from "../kit/ReasonDialog";
import { TooltipProvider } from "../kit/Overlay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let wide = true;
beforeEach(() => {
  wide = true;
  // jsdom has no matchMedia: the kit's useMinWidth reads this one.
  window.matchMedia = ((q: string) => ({ matches: q.includes("min-width") ? wide : false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const render = (ui: ReactNode) =>
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <TooltipProvider>{ui}</TooltipProvider>
      </NextIntlClientProvider>,
    ),
  );
const q = (sel: string) => document.querySelector(sel) as HTMLElement;
const qa = (sel: string) => [...document.querySelectorAll(sel)] as HTMLElement[];
const click = (el: Element) => act(() => void (el as HTMLElement).click());
const key = (el: Element, k: string) => act(() => void el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })));
function type(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

type Row = { id: string; name: string; amount: number | null };
const ROWS: Row[] = [
  { id: "a", name: "Banani", amount: 300 },
  { id: "b", name: "agargaon", amount: null },
  { id: "c", name: "Mirpur 10", amount: 100 },
  { id: "d", name: "Mirpur 2", amount: 300 },
];
const COLS: Column<Row>[] = [
  { id: "name", header: "Name", cell: (r) => r.name, sort: (r) => r.name, primary: true },
  { id: "amount", header: "Amount", cell: (r) => (r.amount === null ? "–" : String(r.amount)), sort: (r) => r.amount, align: "end" },
  { id: "go", header: "Open", cell: (r) => <a href={`#${r.id}`}>open</a> },
];
const names = () => qa("tbody tr").map((tr) => tr.querySelector("td")!.textContent);

describe("sortRows", () => {
  it("sorts text naturally and case-blind, numbers as numbers, blanks last both ways, ties in server order", () => {
    expect(sortRows(ROWS, COLS, { id: "name", dir: "asc" }).map((r) => r.id)).toEqual(["b", "a", "d", "c"]);
    expect(sortRows(ROWS, COLS, { id: "amount", dir: "asc" }).map((r) => r.id)).toEqual(["c", "a", "d", "b"]);
    expect(sortRows(ROWS, COLS, { id: "amount", dir: "desc" }).map((r) => r.id)).toEqual(["a", "d", "c", "b"]);
    expect(sortRows(ROWS, COLS, null)).toBe(ROWS);
    expect(sortRows(ROWS, COLS, { id: "go", dir: "asc" })).toBe(ROWS); // not sortable
  });
});

describe("DataTable", () => {
  it("shows a skeleton while loading, the empty state, and the error with a retry", () => {
    render(<DataTable label="Venues" columns={COLS} rows={undefined} rowId={(r) => r.id} loading />);
    expect(q('[role="status"]').getAttribute("aria-label")).toBe("Loading rows");
    render(<DataTable label="Venues" columns={COLS} rows={[]} rowId={(r) => r.id} empty={{ title: "No venues" }} />);
    expect(host.textContent).toContain("No venues");
    const retry = vi.fn();
    render(<DataTable label="Venues" columns={COLS} rows={undefined} rowId={(r) => r.id} error={new Error("x")} onRetry={retry} />);
    click(q('[role="alert"] button'));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("opens a row by click, Enter or Space, but not from a link inside it; marks the selected row", () => {
    const opened: string[] = [];
    render(<DataTable label="Venues" columns={COLS} rows={ROWS} rowId={(r) => r.id} onRowClick={(r) => opened.push(r.id)} selectedId="c" rowTestId="venue-row" />);
    const rows = qa('[data-testid="venue-row"]');
    expect(rows).toHaveLength(4);
    click(rows[0]);
    key(rows[1], "Enter");
    key(rows[3], " ");
    click(rows[2].querySelector("a")!);
    expect(opened).toEqual(["a", "b", "d"]);
    expect(rows[2].getAttribute("aria-selected")).toBe("true");
    expect(rows[0].getAttribute("aria-selected")).toBe("false");
    expect(rows[0].tabIndex).toBe(0);
  });

  it("sorts only a complete list: asc, desc, then back to the server order", () => {
    render(<DataTable label="Venues" columns={COLS} rows={ROWS} rowId={(r) => r.id} hasMore onMore={() => undefined} />);
    const th = () => q('[data-testid="sort-name"]').closest("th")!;
    expect(th().getAttribute("aria-sort")).toBeNull();
    click(q('[data-testid="sort-name"]'));
    expect(names()).toEqual(["Banani", "agargaon", "Mirpur 10", "Mirpur 2"]); // unchanged: more to load
    render(<DataTable label="Venues" columns={COLS} rows={ROWS} rowId={(r) => r.id} />);
    expect(th().getAttribute("aria-sort")).toBe("none");
    click(q('[data-testid="sort-name"]'));
    expect(th().getAttribute("aria-sort")).toBe("ascending");
    expect(names()).toEqual(["agargaon", "Banani", "Mirpur 2", "Mirpur 10"]);
    click(q('[data-testid="sort-name"]'));
    expect(th().getAttribute("aria-sort")).toBe("descending");
    click(q('[data-testid="sort-name"]'));
    expect(th().getAttribute("aria-sort")).toBe("none");
    expect(names()).toEqual(["Banani", "agargaon", "Mirpur 10", "Mirpur 2"]);
  });

  it("pages: Load more while there is more, and says how many are shown", () => {
    const more = vi.fn();
    render(<DataTable label="Venues" columns={COLS} rows={ROWS} rowId={(r) => r.id} hasMore onMore={more} total={312} />);
    expect(host.textContent).toContain("Showing 4 of 312");
    click(q('[data-testid="load-more"]'));
    expect(more).toHaveBeenCalledOnce();
    render(<DataTable label="Venues" columns={COLS} rows={ROWS} rowId={(r) => r.id} />);
    expect(host.textContent).toContain("All 4 rows");
    expect(q('[data-testid="load-more"]')).toBeNull();
  });

  it("expands rows across the columns", () => {
    render(<DataTable label="Venues" columns={COLS} rows={ROWS} rowId={(r) => r.id} expanded={(r) => (r.id === "a" ? <p data-testid="more-a">entries</p> : null)} />);
    expect(q('[data-testid="more-a"]').closest("td")!.colSpan).toBe(3);
    expect(qa('[data-testid^="more-"]')).toHaveLength(1);
  });

  it("is a list of cards on phones: the primary column is the title, the rest are labelled", () => {
    wide = false;
    const opened: string[] = [];
    render(<DataTable label="Venues" columns={COLS} rows={ROWS} rowId={(r) => r.id} onRowClick={(r) => opened.push(r.id)} rowTestId="venue-row" />);
    expect(q("table")).toBeNull();
    const cards = qa('[data-testid="venue-row"]');
    expect(cards).toHaveLength(4);
    expect(cards[0].querySelector("dt")!.textContent).toBe("Amount");
    click(cards[1].querySelector('[role="button"]')!);
    expect(opened).toEqual(["b"]);
  });
});

describe("FilterBar", () => {
  it("tells the caller about a search 300 ms after the last key, or at once on Enter", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<FilterBar search={{ value: "", onChange, label: "Search", testId: "search" }} />);
    const input = q('[data-testid="search"]') as HTMLInputElement;
    type(input, "mir");
    type(input, "mirpur ");
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(onChange).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("mirpur");
    type(input, "banani");
    key(input, "Enter");
    expect(onChange).toHaveBeenLastCalledWith("banani");
  });

  it("chips pick one value; active filters can be removed one by one or all cleared", () => {
    const status = vi.fn();
    const area = vi.fn();
    const clear = vi.fn();
    render(
      <FilterBar
        chips={{ value: "open", onChange: status, label: "Status", options: [{ value: "", label: "All" }, { value: "open", label: "Open", count: 4 }, { value: "closed", label: "Closed" }] }}
        selects={[{ id: "area", label: "Area", value: "mirpur", onChange: area, options: [{ value: "mirpur", label: "Mirpur" }] }]}
        onClear={clear}
      />,
    );
    expect(q('[data-testid="chip-open"]').getAttribute("aria-pressed")).toBe("true");
    click(q('[data-testid="chip-closed"]'));
    expect(status).toHaveBeenCalledWith("closed");
    expect(q('[data-testid="active-filters"]').textContent).toContain("Area: Mirpur");
    click(q('[aria-label="Remove Area: Mirpur"]'));
    expect(area).toHaveBeenCalledWith("");
    click(q('[data-testid="clear-filters"]'));
    expect(clear).toHaveBeenCalledOnce();
  });
});

describe("FilterBar on phones", () => {
  it("folds the dropdowns into a Filters sheet that counts the active ones; search stays inline", () => {
    wide = false;
    render(
      <FilterBar
        search={{ value: "", onChange: () => undefined, label: "Search", testId: "search" }}
        selects={[
          { id: "area", label: "Area", value: "mirpur", onChange: () => undefined, options: [{ value: "mirpur", label: "Mirpur" }] },
          { id: "status", label: "Status", value: "", onChange: () => undefined, options: [{ value: "live", label: "Live" }] },
        ]}
      />,
    );
    expect(q('[data-testid="search"]')).not.toBeNull();
    expect(q('[data-testid="filter-area"]')).toBeNull();
    expect(q('[data-testid="filters-open"]').textContent).toBe("Filters (1)");
    click(q('[data-testid="filters-open"]'));
    expect(q('[data-testid="filters-sheet"] [data-testid="filter-area"]')).not.toBeNull();
  });
});

describe("ReasonDialog", () => {
  it("needs a reason of the minimum length before it confirms, trimmed", () => {
    const confirm = vi.fn();
    render(<ReasonDialog open onOpenChange={() => undefined} title="Suspend venue" confirmLabel="Suspend" minLength={5} onConfirm={confirm} />);
    const area = document.querySelector("textarea")!;
    type(area, " abc ");
    click(q('[data-testid="reason-dialog-confirm"]'));
    expect(confirm).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Write at least 5 characters.");
    type(area, "  fake photos  ");
    click(q('[data-testid="reason-dialog-confirm"]'));
    expect(confirm).toHaveBeenCalledWith("fake photos");
  });
});
