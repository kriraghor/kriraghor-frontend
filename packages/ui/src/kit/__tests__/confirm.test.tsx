import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { Button } from "../Button";
import { ConfirmProvider } from "../Confirm";

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

const flush = () => act(async () => {
  await Promise.resolve();
});

function mount(onClick: () => void, onSubmit: () => void) {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ConfirmProvider>
          <button type="button" data-testid="plain" onClick={onClick}>
            plain
          </button>
          <Button type="button" confirm="remove" onClick={onClick} data-testid="remove">
            Remove
          </Button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <Button confirm={{ kind: "save", title: "Save the packages?" }} data-testid="save">
              Save
            </Button>
          </form>
        </ConfirmProvider>
      </NextIntlClientProvider>,
    ),
  );
}

const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe("confirm before a change", () => {
  it("runs the action only after a yes; Cancel does nothing", async () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn();
    mount(onClick, onSubmit);
    act(() => q("remove")!.click());
    await flush();
    expect(document.body.textContent).toContain("Remove this?");
    expect(onClick).not.toHaveBeenCalled();
    act(() => q("confirm-cancel")!.click());
    await flush();
    expect(onClick).not.toHaveBeenCalled();

    act(() => q("remove")!.click());
    await flush();
    act(() => q("confirm-ok")!.click());
    await flush();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("asks before a form is submitted, with the given title", async () => {
    const onSubmit = vi.fn();
    mount(() => {}, onSubmit);
    act(() => q("save")!.click());
    await flush();
    expect(document.body.textContent).toContain("Save the packages?");
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => q("confirm-ok")!.click());
    await flush();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
