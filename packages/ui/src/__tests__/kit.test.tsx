import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cn } from "../cn";
import { OtpInput } from "../kit/Form";
import { SegmentedControl } from "../kit/Tabs";
import { buttonClass } from "../kit/Button";
import { Avatar } from "../kit/Display";

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

/** Sets an input's value the way the browser does, so React's onChange fires. */
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const key = (el: Element, k: string) => act(() => void el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })));

describe("cn", () => {
  it("lets a later class of the same kind win, token names included", () => {
    expect(cn("rounded-control px-4", "rounded-card")).toBe("px-4 rounded-card");
    expect(cn("max-w-content", false, "max-w-form")).toBe("max-w-form");
    expect(cn("text-muted text-sm", "text-ink")).toBe("text-sm text-ink");
  });

  it("a caller's className overrides the button's own", () => {
    expect(cn(buttonClass({ size: "md" }), "min-h-10")).toContain("min-h-10");
    expect(cn(buttonClass({ size: "md" }), "min-h-10")).not.toContain("min-h-11");
  });
});

function Otp({ onValue }: { onValue: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <OtpInput
      id="code"
      name="code"
      label="Code"
      value={v}
      onChange={(next) => {
        setV(next);
        onValue(next);
      }}
    />
  );
}

describe("OtpInput", () => {
  it("one-time-code autofill in the first box spreads over all six, and the form gets the value", () => {
    let last = "";
    act(() => root.render(<Otp onValue={(v) => (last = v)} />));
    const boxes = host.querySelectorAll<HTMLInputElement>("input:not([type=hidden])");
    expect(boxes).toHaveLength(6);
    expect(boxes[0].autocomplete).toBe("one-time-code");
    type(boxes[0], "123456");
    expect(last).toBe("123456");
    expect([...boxes].map((b) => b.value).join("")).toBe("123456");
    expect(host.querySelector<HTMLInputElement>("input[type=hidden]")!.value).toBe("123456");
  });

  it("typing moves on, non-digits are ignored, Backspace on an empty box goes back", () => {
    let last = "";
    act(() => root.render(<Otp onValue={(v) => (last = v)} />));
    const boxes = host.querySelectorAll<HTMLInputElement>("input:not([type=hidden])");
    type(boxes[0], "4");
    expect(document.activeElement).toBe(boxes[1]);
    type(boxes[1], "x");
    expect(last).toBe("4");
    type(boxes[1], "2");
    expect(last).toBe("42");
    key(boxes[2], "Backspace");
    expect(last).toBe("4");
    expect(document.activeElement).toBe(boxes[1]);
  });
});

describe("SegmentedControl", () => {
  function Seg() {
    const [v, setV] = useState<"a" | "b" | "c">("a");
    return <SegmentedControl label="View" value={v} onChange={setV} options={[{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }]} />;
  }

  it("is a radio group: one tab stop, arrows move and select, and wrap", () => {
    act(() => root.render(<Seg />));
    const radios = host.querySelectorAll<HTMLButtonElement>("[role=radio]");
    expect(host.querySelector("[role=radiogroup]")!.getAttribute("aria-label")).toBe("View");
    expect([...radios].map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    key(radios[0], "ArrowRight");
    expect(radios[1].getAttribute("aria-checked")).toBe("true");
    key(radios[1], "ArrowLeft");
    key(radios[0], "ArrowLeft");
    expect(radios[2].getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radios[2]);
  });
});

describe("Avatar (trainer photos, 23 Nov 2026)", () => {
  it("is decorative without alt", () => {
    act(() => root.render(<Avatar name="Rafi Ahmed" src="https://cdn.example/r.jpg" size={32} />));
    const span = host.firstElementChild!;
    expect(span.getAttribute("aria-hidden")).toBe("true");
    expect(host.querySelector("img")!.getAttribute("alt")).toBe("");
  });

  it("names the photo with alt, at a fixed size", () => {
    act(() => root.render(<Avatar name="Rafi Ahmed" src="https://cdn.example/r.jpg" size={32} alt="Rafi Ahmed" />));
    const img = host.querySelector("img")!;
    expect(img.getAttribute("alt")).toBe("Rafi Ahmed");
    expect([img.getAttribute("width"), img.getAttribute("height")]).toEqual(["32", "32"]);
    expect(host.firstElementChild!.hasAttribute("aria-hidden")).toBe(false);
  });

  it("announces initials as the person when there is no photo", () => {
    act(() => root.render(<Avatar name="Rafi Ahmed" alt="Rafi Ahmed" size={24} />));
    const span = host.firstElementChild!;
    expect(span.getAttribute("role")).toBe("img");
    expect(span.getAttribute("aria-label")).toBe("Rafi Ahmed");
    expect(span.textContent).toBe("RA");
  });
});
