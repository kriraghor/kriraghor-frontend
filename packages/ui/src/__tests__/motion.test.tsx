import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Flash, FlipTicker } from "../motion";
import { splashScript } from "../brand/BootSplash";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const reduce = (on: boolean) =>
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (q: string) => ({ matches: on && q.includes("reduce"), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });

beforeEach(() => {
  vi.useFakeTimers();
  reduce(false);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const PEOPLE = ["A", "B", "C", "D", "E", "F", "G"];
const labels = { prev: "Prev", next: "Next", pause: "Pause", play: "Play" };
const ticker = (props: Partial<Parameters<typeof FlipTicker<string>>[0]> = {}) => (
  <FlipTicker items={PEOPLE} perPage={3} interval={1000} keyOf={(p) => p} render={(p) => <span>{p}</span>} title="Officials" labels={labels} {...props} />
);
const rows = () => Array.from(host.querySelectorAll("li")).map((li) => li.textContent);
const click = (id: string) => act(() => void host.querySelector<HTMLElement>(`[data-testid=${id}]`)!.click());

describe("FlipTicker (the hire scoreboard)", () => {
  it("shows three at a time; up and down wrap round", () => {
    act(() => root.render(ticker()));
    expect(rows()).toEqual(["A", "B", "C"]);
    click("ticker-next");
    expect(rows()).toEqual(["D", "E", "F"]);
    click("ticker-next");
    expect(rows()).toEqual(["G"]);
    click("ticker-next");
    expect(rows()).toEqual(["A", "B", "C"]);
    click("ticker-prev");
    expect(rows()).toEqual(["G"]);
  });

  it("advances by itself and holds while hovered", () => {
    act(() => root.render(ticker()));
    act(() => void vi.advanceTimersByTime(1000));
    expect(rows()).toEqual(["D", "E", "F"]);
    const box = host.querySelector<HTMLElement>("[data-testid=flip-ticker]")!;
    act(() => void box.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body })));
    act(() => void vi.advanceTimersByTime(3000));
    expect(rows()).toEqual(["D", "E", "F"]);
  });

  it("the Pause button stops it (WCAG 2.2.2) and Play starts it again", () => {
    act(() => root.render(ticker()));
    click("ticker-pause");
    expect(host.querySelector("[data-testid=ticker-pause]")!.getAttribute("aria-pressed")).toBe("true");
    act(() => void vi.advanceTimersByTime(5000));
    expect(rows()).toEqual(["A", "B", "C"]);
    click("ticker-pause");
    act(() => void vi.advanceTimersByTime(1000));
    expect(rows()).toEqual(["D", "E", "F"]);
  });

  it("never moves by itself under reduced motion, and has no Pause button", () => {
    reduce(true);
    act(() => root.render(ticker()));
    act(() => void vi.advanceTimersByTime(10_000));
    expect(rows()).toEqual(["A", "B", "C"]);
    expect(host.querySelector("[data-testid=ticker-pause]")).toBeNull();
    click("ticker-next");
    expect(rows()).toEqual(["D", "E", "F"]);
  });

  it("one page: no controls", () => {
    act(() => root.render(ticker({ items: ["A", "B"] })));
    expect(host.querySelector("[data-testid=ticker-next]")).toBeNull();
  });
});

describe("Flash", () => {
  function Live() {
    const [n, setN] = useState(3);
    return (
      <>
        <Flash value={n}>{n}</Flash>
        <button type="button" onClick={() => setN((x) => x + 1)}>+</button>
      </>
    );
  }

  it("glints only when the value changes, not on first paint", () => {
    act(() => root.render(<Live />));
    const span = host.querySelector("[data-flash]")!;
    expect(span.classList.contains("kg-flash")).toBe(false);
    act(() => void host.querySelector("button")!.click());
    expect(span.classList.contains("kg-flash")).toBe(true);
    expect(span.textContent).toBe("4");
  });
});

describe("boot splash script", () => {
  const run = () => new Function(splashScript)();
  beforeEach(() => {
    sessionStorage.clear();
    delete document.documentElement.dataset.splash;
  });

  it("plays once per session: the second load skips it", () => {
    run();
    expect(document.documentElement.dataset.splash).toBe("on");
    expect(sessionStorage.getItem("kg.splash")).toBe("1");
    run();
    expect(document.documentElement.dataset.splash).toBe("off");
  });

  it("is off under reduced motion", () => {
    reduce(true);
    run();
    expect(document.documentElement.dataset.splash).toBe("off");
  });

  it("never holds the page longer than 2.5 s", () => {
    run();
    vi.advanceTimersByTime(2499);
    expect(document.documentElement.dataset.splash).toBe("on");
    vi.advanceTimersByTime(1);
    expect(document.documentElement.dataset.splash).toBe("out");
  });
});
