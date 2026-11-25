import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readPref, usePref, writePref } from "../prefs";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

const SIZES = ["s", "m", "l"] as const;
function Probe({ k }: { k: string }) {
  const [v, set] = usePref(k, "m", SIZES);
  return (
    <button type="button" onClick={() => set(v === "l" ? "s" : "l")}>
      {v}
    </button>
  );
}

describe("readPref and writePref", () => {
  it("reads the saved value, or the fallback when none is saved or it is not allowed", () => {
    expect(readPref("kg.t1", "m", SIZES)).toBe("m");
    writePref("kg.t1", "l");
    expect(window.localStorage.getItem("kg.t1")).toBe("l");
    expect(readPref("kg.t1", "m", SIZES)).toBe("l");
    writePref("kg.t1", "xl");
    expect(readPref("kg.t1", "m", SIZES)).toBe("m");
    expect(readPref("kg.t1", "m")).toBe("xl"); // no allowed list: any saved value
  });

  it("keeps the choice in memory while storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    writePref("kg.t2", "s");
    expect(readPref("kg.t2", "m", SIZES)).toBe("s");
  });
});

describe("usePref", () => {
  it("shares one choice between readers, saves it, and follows another tab", () => {
    act(() =>
      root.render(
        <>
          <Probe k="kg.t3" />
          <Probe k="kg.t3" />
        </>,
      ),
    );
    const buttons = () => [...host.querySelectorAll("button")].map((b) => b.textContent);
    expect(buttons()).toEqual(["m", "m"]);
    act(() => host.querySelector("button")!.click());
    expect(buttons()).toEqual(["l", "l"]);
    expect(window.localStorage.getItem("kg.t3")).toBe("l");

    // Another tab saved "s"; then cleared storage altogether (key null); other keys are ignored.
    window.localStorage.setItem("kg.t3", "s");
    act(() => void window.dispatchEvent(new StorageEvent("storage", { key: "kg.t3" })));
    expect(buttons()).toEqual(["s", "s"]);
    window.localStorage.setItem("kg.t3", "l");
    act(() => void window.dispatchEvent(new StorageEvent("storage", { key: "kg.other" })));
    expect(buttons()).toEqual(["s", "s"]);
    window.localStorage.clear();
    act(() => void window.dispatchEvent(new StorageEvent("storage", { key: null })));
    expect(buttons()).toEqual(["m", "m"]);
  });
});
