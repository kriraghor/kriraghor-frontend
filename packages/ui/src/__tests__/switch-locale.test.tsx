import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useSwitchLocale } from "../i18n/switch-locale";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const cookieAtRefresh = vi.hoisted(() => ({ value: "" }));
const refresh = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace }) }));

describe("useSwitchLocale", () => {
  it("sets the language cookie, then refreshes so no page stays in the old language", () => {
    refresh.mockImplementation(() => {
      cookieAtRefresh.value = document.cookie;
    });
    let switchLocale!: ReturnType<typeof useSwitchLocale>;
    function Probe() {
      switchLocale = useSwitchLocale();
      return null;
    }
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<Probe />));

    switchLocale("bn");

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(cookieAtRefresh.value).toContain("NEXT_LOCALE=bn");
    // Navigating would drop the query string and leave prefetched pages in the old language.
    expect(replace).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
