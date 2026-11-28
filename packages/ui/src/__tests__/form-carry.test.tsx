import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { restoreForms, snapshotForms } from "../i18n/form-carry";

// Tester feedback, 28 Nov 2026: typed form text survives a language switch, both ways.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no layout: a <main> is "visible" unless it (or a parent) is hidden.
beforeEach(() => {
  (HTMLElement.prototype as unknown as { checkVisibility: () => boolean }).checkVisibility = function (this: HTMLElement) {
    return !this.closest("[hidden]");
  };
  sessionStorage.clear();
});

function Form({ onName }: { onName?: (v: string) => void }) {
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [plan, setPlan] = useState("a");
  return (
    <main>
      <input id="name" value={name} onChange={(e) => (setName(e.target.value), onName?.(e.target.value))} />
      <input name="secret" type="password" defaultValue="" />
      <input type="checkbox" id="agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
      <select id="plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
        <option value="a">A</option>
        <option value="b">B</option>
      </select>
      <textarea name="note" defaultValue="" />
      <div data-no-carry>
        <input id="website" defaultValue="" />
      </div>
    </main>
  );
}

let roots: Root[] = [];
let hosts: HTMLElement[] = [];
const mount = (node: ReactNode) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(node));
  roots.push(root);
  hosts.push(host);
  return host;
};
afterEach(() => {
  roots.forEach((r) => act(() => r.unmount()));
  hosts.forEach((h) => h.remove());
  roots = [];
  hosts = [];
});

const type = (el: HTMLInputElement | HTMLTextAreaElement, v: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, v);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("form carry", () => {
  it("puts typed text back on the page in the other language, through React state; never passwords or marked fields", () => {
    const oldPage = mount(<Form />);
    act(() => {
      type(oldPage.querySelector<HTMLInputElement>("#name")!, "Ayesha");
      type(oldPage.querySelector<HTMLInputElement>('[name="secret"]')!, "hunter2-hunter2");
      oldPage.querySelector<HTMLInputElement>("#agree")!.click();
      const sel = oldPage.querySelector<HTMLSelectElement>("#plan")!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(sel, "b");
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      type(oldPage.querySelector<HTMLTextAreaElement>('[name="note"]')!, "Evening");
      type(oldPage.querySelector<HTMLInputElement>("#website")!, "bot");
    });
    snapshotForms();
    const saved = sessionStorage.getItem("kg.formCarry")!;
    expect(saved).not.toContain("hunter2");
    expect(saved).not.toContain("bot");

    // The switch: the old page is hidden, the new one mounts.
    oldPage.hidden = true;
    let seen = "";
    const newPage = mount(<Form onName={(v) => (seen = v)} />);
    act(() => {
      restoreForms();
    });
    expect(newPage.querySelector<HTMLInputElement>("#name")!.value).toBe("Ayesha");
    expect(seen).toBe("Ayesha"); // React's onChange ran, so the state has it
    expect(newPage.querySelector<HTMLInputElement>("#agree")!.checked).toBe(true);
    expect(newPage.querySelector<HTMLSelectElement>("#plan")!.value).toBe("b");
    expect(newPage.querySelector<HTMLTextAreaElement>('[name="note"]')!.value).toBe("Evening");
    expect(newPage.querySelector<HTMLInputElement>('[name="secret"]')!.value).toBe("");
    expect(newPage.querySelector<HTMLInputElement>("#website")!.value).toBe("");
    // Used up once everything is back.
    expect(sessionStorage.getItem("kg.formCarry")).toBeNull();
  });

  it("does nothing for another page or an old snapshot", () => {
    sessionStorage.setItem("kg.formCarry", JSON.stringify({ path: "/elsewhere", at: Date.now(), fields: [{ k: "#name", v: "X" }] }));
    const page = mount(<Form />);
    act(() => {
      restoreForms();
    });
    expect(page.querySelector<HTMLInputElement>("#name")!.value).toBe("");
    sessionStorage.setItem("kg.formCarry", JSON.stringify({ path: location.pathname, at: Date.now() - 120_000, fields: [{ k: "#name", v: "X" }] }));
    act(() => {
      restoreForms();
    });
    expect(page.querySelector<HTMLInputElement>("#name")!.value).toBe("");
  });

  it("keeps trying for a form that appears a moment later, then gives up and drops the snapshot", async () => {
    sessionStorage.setItem("kg.formCarry", JSON.stringify({ path: location.pathname + location.search, at: Date.now(), fields: [{ k: "#name", v: "Late" }, { k: "#gone", v: "never" }] }));
    const empty = mount(<main />);
    const cancel = restoreForms({ tries: 5, everyMs: 5 });
    empty.hidden = true;
    const page = mount(<Form />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(page.querySelector<HTMLInputElement>("#name")!.value).toBe("Late");
    expect(sessionStorage.getItem("kg.formCarry")).toBeNull();
    cancel();
  });
});
